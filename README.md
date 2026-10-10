# Tak · A Beautiful Game

A dependency-free browser game for two people sharing a device. Open `index.html`
in a modern browser (including on Windows); no installation, account, server, or
network connection is needed. The original game remains at `shut-the-box.html`.

## Playing Tak

- Choose a board from 3×3 to 8×8 and press **New game** (default: 5×5).
- White starts. Each player's first turn places an **opponent's flat stone**.
- After the opening, choose **Flat**, **Wall**, or **Capstone**, then an empty square.
- To move, choose **Move a stack**, select a stack with your color on top, choose
  how many top pieces to carry and a direction, and enter comma-separated drop
  counts. For example, carrying three and entering `1, 2` drops one on the first
  square and two on the next. A legal route is highlighted before confirmation.
- Inspect any stack to see its pieces from top to bottom. **Undo turn** takes back
  a completed move, including a winning move.
- A road of visible flats/capstones connecting opposite edges wins. If the board
  fills or a player exhausts both reserves, most visible flats wins instead.
  Walls and capstones do not count toward flat scores. Roads take priority, and
  the mover wins when both roads are completed simultaneously.

The board's width is the carry limit. Pieces are dropped bottom-first in a
straight orthogonal line. Capstones cannot be covered; a capstone can flatten
a wall only when dropped alone as the final piece.

| Board | Stones per player | Capstones per player |
| --- | ---: | ---: |
| 3×3 | 10 | 0 |
| 4×4 | 15 | 0 |
| 5×5 | 21 | 1 |
| 6×6 | 30 | 1 |
| 7×7 | 40 | 2 |
| 8×8 | 50 | 2 |

The interface includes a rules summary and links to the
[supplied rulebook](https://www.racingcow.io/pdf/games/tak_optimized.pdf) and
[US Tak Association rules](https://ustak.org/play-beautiful-game-tak/).
The supplied PDF could not be retrieved during development; the implemented
rules follow published Tak rules, and piece/board graphics are drawn with CSS.
This edition is local pass-and-play, not an online multiplayer or computer opponent.
Refreshing the page resets the game.

## Development

`tak-engine.js` contains the independent rules engine; `tak.js` handles browser
interaction, and `tak.css` renders the board and pieces. The legacy game's
`script.js` and `styles.css` are retained separately.

Run the rule checks using Node's built-in test runner:

```sh
node --test tak-engine.test.js
```

For browser development, serve this directory with any static web server, or
open the HTML files directly.
