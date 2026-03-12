import { state } from "./state.js";

export function addLog(message) {
  state.logs.push(message);

  // 上限管理（例: 100件）
//   if (state.logs.length > 100) {
//     state.logs.shift();
//   }
}

export function clearLogs() {
  state.logs = [];
}