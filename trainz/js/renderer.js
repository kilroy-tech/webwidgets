import {
  getAllSwitchPaths,
  getPiecePaths,
  rotateDirection,
} from "./track-types.js";

export class Renderer {
  constructor(canvas, appState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = appState;
    this.cell = 64;
    this.origin = { x: 0, y: 0 };
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const box = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = box.width * dpr;
    this.canvas.height = box.height * dpr;
    this.canvas.style.width = box.width + "px";
    this.canvas.style.height = box.height + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.origin = { x: box.width / 2, y: box.height / 2 };
    this.draw();
  }

  gridPoint(x, y) {
    return {
      x: this.origin.x + x * this.cell,
      y: this.origin.y + y * this.cell,
    };
  }

  cellAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.round((clientX - rect.left - this.origin.x) / this.cell),
      y: Math.round((clientY - rect.top - this.origin.y) / this.cell),
    };
  }

  draw() {
    const box = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, box.width, box.height);
    this.ctx.fillStyle = "#101719";
    this.ctx.fillRect(0, 0, box.width, box.height);
    this.ctx.strokeStyle = "rgba(145,178,169,.12)";
    this.ctx.lineWidth = 1;
    for (let x = -20; x <= 20; x++) {
      for (let y = -15; y <= 15; y++) {
        const point = this.gridPoint(x, y);
        this.ctx.beginPath();
        this.ctx.moveTo(point.x - 3, point.y);
        this.ctx.lineTo(point.x + 3, point.y);
        this.ctx.moveTo(point.x, point.y - 3);
        this.ctx.lineTo(point.x, point.y + 3);
        this.ctx.stroke();
      }
    }
    this.state.pieces.forEach((piece) => this.drawPiece(piece));
    this.state.trains.forEach((train) => this.drawTrain(train));
  }

  drawPaths(ctx, paths, half) {
    const points = { N: [0, -half], E: [half, 0], S: [0, half], W: [-half, 0] };
    paths.forEach(([from, to, geometry, active = true]) => {
      const start = points[from];
      const end = to ? points[to] : [0, 0];
      this.drawTrackPath(ctx, start, end, geometry, half, active, Boolean(to));
    });
  }

  drawTrackPath(ctx, start, end, geometry, half, active, hasEnd) {
    const railColor = active ? "#d5ddd8" : "rgba(213,221,216,.28)";
    const bedColor = active ? "rgba(79,61,49,.9)" : "rgba(79,61,49,.28)";
    const railOffset = 6;
    ctx.lineCap = "butt";
    const sampleCount = geometry === "curve" && hasEnd ? 16 : 5;
    const centerPoints = [];
    for (let index = 0; index <= sampleCount; index++) {
      centerPoints.push(
        this.getPathPoint(start, end, geometry, index / sampleCount, hasEnd),
      );
    }
    const railPoints = (offset) =>
      centerPoints.map((point, index) => {
        const previous = centerPoints[Math.max(0, index - 1)];
        const next = centerPoints[Math.min(centerPoints.length - 1, index + 1)];
        const length =
          Math.hypot(next.x - previous.x, next.y - previous.y) || 1;
        const tangentX = (next.x - previous.x) / length;
        const tangentY = (next.y - previous.y) / length;
        const endpointOverlap =
          hasEnd && (index === 0 || index === centerPoints.length - 1)
            ? 1.5
            : 0;
        const endpointDirection = index === 0 ? -1 : 1;
        return {
          x:
            point.x +
            tangentX * endpointOverlap * endpointDirection -
            tangentY * offset,
          y:
            point.y +
            tangentY * endpointOverlap * endpointDirection +
            tangentX * offset,
        };
      });
    this.drawPolyline(ctx, centerPoints, bedColor, 17);
    const ties = geometry === "curve" ? 6 : 5;
    for (let index = 0; index < ties; index++) {
      const normalizedPosition = (index + 0.5) / ties;
      const pointIndex = Math.round(normalizedPosition * sampleCount);
      const point = centerPoints[pointIndex];
      const previous = centerPoints[Math.max(0, pointIndex - 1)];
      const next =
        centerPoints[Math.min(centerPoints.length - 1, pointIndex + 1)];
      const tangentX = next.x - previous.x;
      const tangentY = next.y - previous.y;
      const length = Math.hypot(tangentX, tangentY) || 1;
      const normalX = -tangentY / length;
      const normalY = tangentX / length;
      ctx.strokeStyle = active ? "#705a49" : "rgba(112,90,73,.3)";
      ctx.lineWidth = 4;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.moveTo(point.x - (normalX * 22) / 2, point.y - (normalY * 22) / 2);
      ctx.lineTo(point.x + (normalX * 22) / 2, point.y + (normalY * 22) / 2);
      ctx.stroke();
    }
    this.drawPolyline(ctx, railPoints(-railOffset), railColor, 3);
    this.drawPolyline(ctx, railPoints(railOffset), railColor, 3);
  }

  getPathPoint(start, end, geometry, t, hasEnd) {
    if (!hasEnd) return { x: start[0] * (1 - t), y: start[1] * (1 - t) };
    if (geometry === "curve")
      return {
        x: (1 - t) * (1 - t) * start[0] + t * t * end[0],
        y: (1 - t) * (1 - t) * start[1] + t * t * end[1],
      };
    return {
      x: start[0] + (end[0] - start[0]) * t,
      y: start[1] + (end[1] - start[1]) * t,
    };
  }

  drawPolyline(ctx, points, color, width) {
    if (!points.length) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.stroke();
  }

  drawPreview(canvas, type, rotation = 0) {
    const ctx = canvas.getContext("2d");
    const size = 58;
    const scale = size / this.cell;
    const half = this.cell / 2;
    const piece = {
      type,
      rotation,
      switchState: "straight",
      station: { name: "", side: "N", color: "#e9b86e" },
    };
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.scale(scale, scale);
    ctx.lineCap = "round";
    this.drawPaths(
      ctx,
      type.startsWith("switch")
        ? getAllSwitchPaths(piece)
        : getPiecePaths(piece),
      half,
    );
    if (type.startsWith("switch")) {
      ctx.fillStyle = "#71d3bc";
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (type === "station") this.drawStationLabel(ctx, piece, half, true);
    ctx.restore();
  }

  drawPiece(piece) {
    const point = this.gridPoint(piece.gridX, piece.gridY);
    const half = this.cell / 2;
    this.ctx.save();
    this.ctx.translate(point.x, point.y);
    this.ctx.lineCap = "round";
    this.drawPaths(
      this.ctx,
      piece.type.startsWith("switch")
        ? getAllSwitchPaths(piece)
        : getPiecePaths(piece),
      half,
    );
    if (piece.type === "station")
      this.drawStationLabel(this.ctx, piece, half, false);
    if (piece.type.startsWith("switch")) {
      this.ctx.fillStyle =
        piece.switchState === "branch" ? "#d95757" : "#71d3bc";
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 5, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.restore();
  }

  drawStationLabel(ctx, piece, half, preview) {
    const side = rotateDirection(
      piece.station?.side || "N",
      (piece.rotation || 0) / 90,
    );
    const position = {
      N: [-half + 12, -half + 10],
      E: [half - 10, -half + 12],
      S: [half - 12, half - 10],
      W: [-half + 10, half - 12],
    }[side];
    const color = piece.station?.color || "#e9b86e";
    const markerSize = preview ? 14 : 18;
    ctx.fillStyle = color;
    ctx.fillRect(
      position[0] - markerSize / 2,
      position[1] - markerSize / 2,
      markerSize,
      markerSize,
    );
    ctx.fillStyle = "#fff1cf";
    ctx.fillRect(
      position[0] - markerSize / 2 + 3,
      position[1] - markerSize / 2 + 3,
      markerSize - 6,
      markerSize - 6,
    );
    if (preview || !piece.station?.name) return;
    ctx.font = "11px DM Mono";
    ctx.textAlign = side === "E" ? "left" : side === "W" ? "right" : "center";
    ctx.textBaseline =
      side === "N" ? "bottom" : side === "S" ? "top" : "middle";
    const labelX =
      position[0] +
      (side === "E"
        ? markerSize / 2 + 5
        : side === "W"
          ? -markerSize / 2 - 5
          : 0);
    const labelY =
      position[1] +
      (side === "N"
        ? -markerSize / 2 - 5
        : side === "S"
          ? markerSize / 2 + 5
          : 0);
    const width = ctx.measureText(piece.station.name).width + 8;
    ctx.fillStyle = "rgba(16,23,25,.9)";
    ctx.fillRect(
      labelX - (side === "W" ? width : side === "E" ? 0 : width / 2),
      labelY - (side === "N" ? 14 : side === "S" ? 0 : 7),
      width,
      14,
    );
    ctx.fillStyle = color;
    ctx.fillText(piece.station.name, labelX, labelY);
  }

  drawTrain(train) {
    const piece = [...this.state.pieces.values()].find(
      (candidate) => candidate.id === train.pieceId,
    );
    if (!piece || !train.entry || !train.exit) return;
    const points = {
      N: [0, -this.cell / 2],
      E: [this.cell / 2, 0],
      S: [0, this.cell / 2],
      W: [-this.cell / 2, 0],
    };
    const start = points[train.entry];
    const end = points[train.exit];
    if (!start || !end) return;
    const t = Math.max(0, Math.min(1, train.progress));
    let x;
    let y;
    let tangent;
    if (train.geometry === "curve") {
      x = (1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * 0 + t * t * end[0];
      y = (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * 0 + t * t * end[1];
      tangent = Math.atan2(
        2 * (1 - t) * -start[1] + 2 * t * end[1],
        2 * (1 - t) * -start[0] + 2 * t * end[0],
      );
    } else {
      x = start[0] + (end[0] - start[0]) * t;
      y = start[1] + (end[1] - start[1]) * t;
      tangent = Math.atan2(end[1] - start[1], end[0] - start[0]);
    }
    const bodyAngle = tangent + (train.direction < 0 ? Math.PI : 0);
    const point = this.gridPoint(piece.gridX, piece.gridY);
    this.ctx.save();
    this.ctx.translate(point.x + x, point.y + y);
    this.ctx.rotate(bodyAngle);
    this.ctx.fillStyle = "rgba(255, 243, 166, 0.14)";
    this.ctx.beginPath();
    this.ctx.moveTo(15, 0);
    this.ctx.lineTo(62, -24);
    this.ctx.lineTo(62, 24);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.fillStyle = train.color || "#2878c8";
    this.ctx.strokeStyle = "#d8efff";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.roundRect(-15, -8, 30, 16, 4);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.fillStyle = "#fff3a6";
    this.ctx.fillRect(11, -5, 3, 10);
    this.ctx.restore();
  }
}
