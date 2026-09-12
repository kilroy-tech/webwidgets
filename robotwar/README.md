# RobotWar Webwidget

This folder is the working area for a browser-based, relatively faithful clone of Silas Warner's 1981 Apple II game **RobotWar**. The original manual is preserved as `Robotwar.pdf`.

## Running the Widget

Kilroy serves this repository under `/kilroypublic`. Open the widget through the running Kilroy server:

```text
http://localhost:3000/kilroypublic/webwidgets/robotwar/index.html?{{bootstrap_args}}
```

For direct browser testing without injected webwidget arguments, use:

```text
http://localhost:3000/kilroypublic/webwidgets/robotwar/index.html
```

Do not start a separate static server for this widget. Ace, Lucide icons, and the two UI fonts are loaded from public CDNs; a plain textarea is used if Ace is unavailable.

## Implemented Features

- Two-to-five editable robot programs with three included examples.
- Ace source editing, browser import/export, local persistence, and Kilroy KV persistence.
- RobotWar tokenizer, parser, label resolution, eight diagnostic classes, source mapping, and 256-object-instruction limit.
- Accumulator VM with arithmetic, comparisons, conditional commands, branches, subroutines, all 34 registers, `DATA` indirection, and seeded `RANDOM`.
- Test bench with object-code highlighting, run/pause/step/reset, program counter, accumulator, register inspection, radar injection, damage injection, and the same movement, wall collisions, shells, and damage physics as a battle.
- Fixed-timestep battles with acceleration, collisions, radar rays, gun cooldown, fused shells, blast damage, elimination, and survivor scoring.
- One-to-99 battle scheduled matches with cumulative scores and deterministic seeds.
- A fresh seed and seed-driven spawn assignment for every battle by default; entering a seed enables reproducible replays.
- Responsive canvas presentation for desktop and mobile webwidget windows.

Run the engine and compiler tests with `npm test` from this folder.

## Scope

The widget will provide:

- An Ace-based source editor for multiple robot programs.
- Load/save of robot source files using modern browser file APIs and widget storage.
- A source compiler with RobotWar-compatible syntax and diagnostics.
- An accumulator-based object-code virtual machine, including a debugger/test bench.
- A battlefield simulator for two to five independently programmed robots.
- Single battles and scheduled multi-battle matches with cumulative scoring.

The Apple II text editor, disk-management UI, printer support, and main-menu key choreography are not in scope.

## Manual Review Scope

The PDF has 83 physical pages. This review covers:

- Physical pages 1-45: introduction, battles, robot hardware, registers, language, programming examples, and the complete sample robot.
- Physical pages 46-61: reviewed only to identify and exclude the old editor/file UI.
- Physical pages 62-71: assembler, object code, and test bench.
- Physical pages 72-83: storage/deletion/key-reference and advertising material; relevant robot source/object-file concepts were noted, but Apple II disk procedures are excluded.

The manual's printed page number is five less than the PDF physical page number through the technical chapters. The editor starts on physical page 46 (printed page 41), while the assembler starts on physical page 62 (printed page 57). This explains the two requested review ranges.

## Original Game Model

### Battles and scoring

- The battlefield is a square bounded by four impenetrable 260-meter walls.
- A battle supports at most five robots and is intended to continue until one survives.
- The original automatically ends a battle if the robots fail to damage one another; the manual does not state the inactivity duration.
- A robot starts with `DAMAGE = 100` and is destroyed when it reaches `0`. The prose also describes this as incurring 100% damage.
- A shell exploding directly on a robot can remove 30 damage points. Damage decreases with distance, but the exact falloff is not specified.
- Wall and robot collisions cause damage based on collision angle. A head-on robot collision can remove 25 points from both robots; no complete collision formula is given.
- Whenever a robot is destroyed, every surviving robot earns one point. Therefore, the winner of a five-robot battle earns four points.
- Scores are cumulative across battles and reset whenever that robot's program changes.
- A scheduled match runs a selected number of battles consecutively and presents aggregate results.

### Coordinates and directions

- The readable coordinate range is `0..256` on both axes, inside the nominal 260-meter enclosure.
- `(0, 0)` is the top-left; X increases rightward and Y increases downward.
- Angles are degrees: `0` north, `90` east, `180` south, and `270` west.
- Each robot has a 1.5-meter-square tracked chassis, independent horizontal and vertical drive, a 360-degree gun, radar, damage sensors, and a computer.

The discrepancy between 260-meter walls and `0..256` register coordinates is in the manual. Initial placement, robot footprint collision geometry, shell speed, radar width, simulation tick duration, and inactivity timeout are not specified and must be calibrated or explicitly chosen.

## Registers

The machine has 34 numbered registers. All source-visible numeric values are integers.

| Number | Name | Meaning |
| ---: | --- | --- |
| 1-23 | `A`-`W` | General storage |
| 24 | `X` | Current horizontal position, `0..256` |
| 25 | `Y` | Current vertical position, `0..256` |
| 26 | `Z` | General storage |
| 27 | `AIM` | Gun direction, `0..359` |
| 28 | `SHOT` | Write fused distance to fire; read cooldown, with `0` meaning ready |
| 29 | `RADAR` | Write direction to pulse; read signed result |
| 30 | `DAMAGE` | Remaining integrity, initially `100`, destroyed at `0` |
| 31 | `SPEEDX` | Requested/current horizontal velocity, `-255..255` dm/s |
| 32 | `SPEEDY` | Requested/current vertical velocity, `-255..255` dm/s |
| 33 | `RANDOM` | Write upper limit; reads produce random values |
| 34 | `INDEX` | Selects another register by number for indirect access through `DATA` |

`X` and `Y` are I/O registers rather than storage registers, which is why the storage sequence is `A` through `W`, then `Z`.

`DATA` is the indirect pseudo-register and is not itself in the numbered list. Writing `27 TO INDEX` makes subsequent `DATA` references access `AIM`. The prose says `INDEX` accepts `0..34`, but does not define index `0`; this should be treated as an unresolved compatibility case.

### I/O semantics

- Writing `AIM` turns the gun to the normalized angle; reading it returns the current gun direction.
- Writing `RADAR` with `0..359` emits a beam. On return, a positive value is distance to a wall and a negative value is distance to an enemy. The documented result magnitude is `0..400`.
- Writing a distance to `SHOT` fires along the current `AIM` direction with the shell fused to explode after that many meters. Reading `SHOT` reports cooldown; another shot is permitted at `0`. Exact cooldown and projectile speed are unspecified.
- `SPEEDX < 0` moves left, `SPEEDX > 0` moves right, `SPEEDY < 0` moves up, and `SPEEDY > 0` moves down.
- Velocity changes at 40 dm/s each second. For example, changing from `0` to `120` takes three seconds, and braking from `120` to `0` also takes three seconds.
- Writing `RANDOM` sets its limit. The detailed example specifies that a limit of `100` yields integers `0..99`; each subsequent read advances the generator. The earlier prose says “between 0 and the limit,” but the programming example establishes an exclusive upper bound.

## Source Language

Source consists of comments, labels, and instructions. It is case-insensitive in the Apple II presentation; the clone should preserve entered case but normalize identifiers while compiling.

### Lexical rules

- A semicolon starts a comment anywhere on a line.
- A label starts at the beginning of a source line (the manual depicts the editor's return marker before it), begins with `A`-`Z`, contains at least two alphanumeric characters, and is shorter than 32 characters.
- Labels cannot equal register or command names.
- Numeric literals are signed integers from `-1024` through `1024` inclusive.
- Parentheses and fractional numbers are illegal.
- Whitespace is not semantically significant; manual examples sometimes omit spaces, such as `0-BTOA`.

### Commands and operators

| Token | Effect |
| --- | --- |
| `TO` | Store the accumulator in the following register; may be chained |
| `+` | Add the following data item to the accumulator |
| `-` | Subtract the following data item from the accumulator |
| `*` | Multiply the accumulator by the following data item |
| `/` | Divide the accumulator by the following data item |
| `IF` | Begin a conditional expression |
| `=`, `>`, `<`, `#` | Equal, greater, less, and not equal comparisons |
| `GOTO` | Branch to a label, literal instruction address, or address held in a register |
| `GOSUB` | Call a label and retain a return address |
| `ENDSUB` | Return to the instruction following the call |

The OCR renders `/` and `#` inconsistently in a few tables; surrounding prose and examples establish division as `/` and not-equal as `#`.

### Evaluation model

- Each expression starts by loading its first number, register, or resolved label address into the accumulator.
- Arithmetic then executes strictly from left to right; parentheses are not supported and ordinary precedence must not be introduced.
- Arithmetic is allowed on the left side of a comparison, but not on its right side. For example, `IF A+3>B GOTO LABEL` is legal and `IF A+B=C*3 GOTO LABEL` is illegal.
- Negative literals are legal (`-240 TO SPEEDX`), but unary negation of a register is not. Use `0-A TO B`.
- A comparison controls exactly the following command. When true, that command executes; when false, it is skipped. The conditionally controlled command may be `TO`, `GOTO`, `GOSUB`, or `ENDSUB`.
- Labels are numeric instruction addresses and can be loaded/stored as data.
- Source lines may compile to multiple object instructions. `AIM + 5 TO AIM`, for example, becomes load, add, and store operations.

Representative legal statements:

```text
A TO B
100+B-C*D/E TO F
0 TO SPEEDX TO SPEEDY
GOTO LABEL
GOTO 3
GOTO A
IF A+3>B GOTO LABEL
IF A=B C*4 TO C
IF A=B GOSUB LABEL
IF A=B ENDSUB
```

## Compiler and Object Code

The assembler resolves labels and translates source into an accumulator-machine instruction stream. Programs are limited to 256 object instructions, not 256 source lines.

The manual's sample translation is:

```text
SCAN
0   LOAD AIM
1   ADD 5
2   STORE AIM
3   LOAD AIM
4   STORE RADAR
LOOP
5   IF_LOAD RADAR
6   LESS_THAN 0
7   GOSUB FIRE
8   GOTO SCAN
FIRE
9   LOAD 0
10  SUBTRACT RADAR
11  STORE SHOT
12  ENDSUB
```

The original displays symbolic object opcodes rather than the descriptive names above. The semantic instruction set is: load accumulator, conditional load/start (`IF`), add, subtract, multiply, divide, four comparisons, store, branch, call, and return. Each operation consumes its following data item or address as applicable.

Comparisons are implemented as skip-next-command operations: equality, greater-than, and less-than skip the next command unless true; not-equal skips the next command when equality is true. This is the object-level basis of source `IF` behavior.

The assembler reports eight diagnostic classes:

1. `NO DATA FIELD`: no register or number follows a command.
2. `UNKNOWN ITEM`: undefined register or label.
3. `LARGE NUMBER`: literal greater than `1024` or less than `-1024`.
4. `PROGRAM TOO LONG`: more than 256 object instructions.
5. `FATAL JUNK`: unrecognized or illegal source.
6. `STORE IN NUMBER`: attempted assignment to a numeric literal.
7. `RESERVED LABEL`: label collides with a register name.
8. `NO PROGRAM CODE`: source contains no instructions.

Diagnostics include the class, source line number, offending line, and character position. The modern compiler should retain that information and add clear messages without weakening compatibility.

## Runtime Model

Each robot owns isolated state:

- Object-code array of at most 256 instructions.
- Program counter.
- Accumulator.
- Call stack (the manual defines call/return but does not state nesting depth).
- General registers and hardware-facing I/O register state.
- Position, actual and requested velocity, gun state, radar state, projectile state, integrity, score, and alive flag.

The VM executes object instructions sequentially, mutating the accumulator, registers, program counter, and call stack. Hardware writes enqueue or initiate simulator actions; hardware reads expose the latest hardware state. The manual does not state CPU instruction frequency, robot scheduling order, or whether radar and gun effects consume VM cycles. A deterministic round-robin scheduler with a fixed simulation timestep is the safest initial model, but it is an implementation choice to validate against observed original gameplay.

For reproducible battles, the web clone should use a seeded PRNG per match. That is a modern implementation requirement, not a rule stated by the manual.

## Test Bench

The original test bench is a single-robot microcomputer simulator. It displays:

- The object instruction currently executing.
- Program counter and accumulator.
- Position and selected register contents.
- A traced additional register.

It can pause, single-step one object instruction, resume, and change execution display speed from `0` to `9`. It can inject a radar detection (a negative `RADAR` value) and a random hit of up to 10 damage points. It also reports wall-collision damage and stops when `DAMAGE` reaches `0`.

The webwidget should preserve these debugging capabilities as controls around the Ace editor and compiled-object listing rather than recreate the Apple II screen.

## Implementation Boundaries

The simulator should keep four layers separate:

1. **Parser/compiler**: source text to diagnostics, symbols, and object instructions.
2. **Robot VM**: deterministic execution of one object instruction at a time.
3. **Battlefield physics**: movement, acceleration, collisions, radar ray tests, shells, explosions, damage, elimination, and scoring.
4. **UI/orchestration**: Ace source tabs, robot roster, compile controls, test bench, battle canvas, match controls, speed, results, import/export, and Kilroy lifecycle/storage.

This separation lets compiler and VM compatibility be tested without animation timing, and lets unresolved physics constants be calibrated without changing language semantics.

## Open Compatibility Questions

The manual does not fully specify these values or behaviors:

- CPU instruction rate and multi-robot scheduling.
- Arithmetic overflow range, division rounding, and division by zero.
- Label case sensitivity and exact whitespace tokenization.
- Call-stack depth and behavior on stack underflow/overflow.
- `INDEX = 0` and invalid indirect indices.
- Out-of-range writes to angle, speed, fuse, and random-limit registers.
- Gun cooldown, shell speed, blast radius, and damage falloff.
- Radar beam width, robot hitbox, and tie-breaking when wall and robot intersections coincide.
- Collision formulas, wall damage, spawn placement, inactivity timeout, and simultaneous destruction scoring.

These should be centralized as documented compatibility constants, covered by deterministic tests, and adjusted from emulator/original-game observation rather than hidden in rendering code.

## Initial Build Order

1. Implement lexer/parser, assembler diagnostics, symbol resolution, and the 256-instruction object format.
2. Implement the single-robot VM and test bench with instruction stepping.
3. Implement deterministic arena physics and all I/O registers.
4. Add two-to-five robot loading, battle orchestration, scoring, and scheduled matches.
5. Add Ace integration, source/object import/export, Kilroy SDK bootstrap, persistence, and responsive canvas UI.