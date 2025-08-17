"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CellType = exports.GameState = void 0;
var GameState;
(function (GameState) {
    GameState["WAITING"] = "waiting";
    GameState["STARTING"] = "starting";
    GameState["IN_PROGRESS"] = "in_progress";
    GameState["FINISHED"] = "finished";
})(GameState || (exports.GameState = GameState = {}));
var CellType;
(function (CellType) {
    CellType[CellType["WALL"] = 0] = "WALL";
    CellType[CellType["EMPTY"] = 1] = "EMPTY";
    CellType[CellType["START"] = 2] = "START";
    CellType[CellType["END"] = 3] = "END";
    CellType[CellType["CHECKPOINT"] = 4] = "CHECKPOINT";
})(CellType || (exports.CellType = CellType = {}));
//# sourceMappingURL=game.js.map