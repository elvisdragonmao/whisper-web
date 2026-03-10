const $ = (id) => document.getElementById(id);

const file = $("file");
const traditional = $("traditional");
const startBtn = $("start");
const pauseBtn = $("pause");
const filenameEl = $("filename");
const output = $("output");
const stats = $("stats");
const bar = $("bar");
const downloads = $("downloads");
const txt = $("txt");
const srt = $("srt");
const history = $("history");
const refreshBtn = $("refresh");

let currentJobId = null;
let ws = null;

function fmtTime(ts){
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

function fmtSec(s){
  if (s === null || s === undefined || !isFinite(s)) return "—";
  return `${Number(s).toFixed(1)}s`;
}

function connectWS(jobId){
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws/${jobId}`);

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);

    if (msg.type === "segment"){
      output.textContent += msg.text + "\n"; // TXT 每段換行
      output.scrollTop = output.scrollHeight;

      const percent = msg.percent ?? (msg.audio_total ? (msg.processed_audio / msg.audio_total * 100) : 0);
      const speed = msg.speed ?? (msg.wall_elapsed ? (msg.processed_audio / msg.wall_elapsed) : 0);

      bar.style.width = Math.min(percent, 100).toFixed(1) + "%";

      stats.textContent =
        `已跑音訊 ${fmtSec(msg.processed_audio)} / ${fmtSec(msg.audio_total)} `
        + `• ${Number(percent).toFixed(1)}% `
        + `• 已用時間 ${fmtSec(msg.wall_elapsed)} `
        + `• 速度 x${Number(speed).toFixed(2)}`;
    }

    if (msg.type === "paused"){
      stats.textContent = "已暫停（任務取消、GPU已釋放）";
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      downloads.hidden = true;
      cleanupWS();
      loadHistory();
    }

    if (msg.type === "done"){
      bar.style.width = "100%";
      downloads.hidden = false;
      stats.textContent += " • 完成 ✅";
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      cleanupWS();
      loadHistory();
    }

    if (msg.type === "error"){
      stats.textContent = "錯誤： " + (msg.message || "unknown");
      startBtn.disabled = false;
      pauseBtn.disabled = true;
      downloads.hidden = true;
      cleanupWS();
      loadHistory();
    }
  };

  ws.onclose = () => cleanupWS();
}

function cleanupWS(){
  try { ws && ws.close(); } catch {}
  ws = null;
  currentJobId = null;
}

file.onchange = () => {
  const f = file.files[0];
  if (!f) return;
  filenameEl.textContent = f.name;
  filenameEl.title = f.name;
};

startBtn.onclick = async () => {
  const f = file.files[0];
  if (!f) return alert("請選檔案");

  // reset UI
  output.textContent = "";
  stats.textContent = "上傳中…";
  bar.style.width = "0%";
  downloads.hidden = true;

  startBtn.disabled = true;
  pauseBtn.disabled = false;

  const fd = new FormData();
  fd.append("file", f);
  fd.append("traditional", traditional.checked);

  const res = await fetch("/upload", { method: "POST", body: fd });
  const { job_id } = await res.json();

  currentJobId = job_id;
  txt.href = `/download/${job_id}.txt`;
  srt.href = `/download/${job_id}.srt`;

  connectWS(job_id);
};

pauseBtn.onclick = async () => {
  if (!currentJobId) return;
  pauseBtn.disabled = true;
  stats.textContent = "取消中…（釋放GPU）";
  await fetch(`/job/${currentJobId}/pause`, { method: "POST" });
  // 後端會透過 ws 回 paused；若 ws 已斷，history 也看得到狀態
};

async function resumeJob(oldJobId){
  // 重新跑（產生新 job_id）
  const res = await fetch(`/job/${oldJobId}/resume`, { method: "POST" });
  const { job_id } = await res.json();

  // UI 直接切到新 job 觀看
  output.textContent = "";
  downloads.hidden = true;
  bar.style.width = "0%";
  stats.textContent = "重跑開始…";
  startBtn.disabled = true;
  pauseBtn.disabled = false;

  currentJobId = job_id;
  txt.href = `/download/${job_id}.txt`;
  srt.href = `/download/${job_id}.srt`;

  connectWS(job_id);
}

async function loadHistory(){
  const jobs = await fetch("/jobs").then(r => r.json());
  if (!jobs.length){
    history.textContent = "沒有紀錄";
    return;
  }

  history.innerHTML = "";
  for (const j of jobs){
    const item = document.createElement("div");
    item.className = "item";

    const left = document.createElement("div");
    left.className = "left";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = j.filename || "(unknown)";
    name.title = j.filename || "";

    const meta = document.createElement("div");
    meta.className = "meta";

    const wall = (j.wall_total ?? null);
    const avg = (j.avg_speed ?? null);
    const gpu = (j.gpu_name ?? (j.gpu_id !== null && j.gpu_id !== undefined ? `GPU ${j.gpu_id}` : "—"));

    meta.textContent =
      `狀態: ${j.status}`
      + ` • 上傳: ${fmtTime(j.created_at)}`
      + ` • 耗時: ${fmtSec(wall)}`
      + ` • 平均: x${avg === null || avg === undefined ? "—" : Number(avg).toFixed(2)}`
      + ` • GPU: ${gpu}`;

    left.appendChild(name);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.className = "right";

    const aTxt = document.createElement("a");
    aTxt.href = `/download/${j.job_id}.txt`;
    aTxt.textContent = "TXT";
    aTxt.target = "_blank";

    const aSrt = document.createElement("a");
    aSrt.href = `/download/${j.job_id}.srt`;
    aSrt.textContent = "SRT";
    aSrt.target = "_blank";

    // 只有 done 才一定有檔；paused/error 可能沒有
    if (j.status !== "done"){
      aTxt.style.opacity = "0.35";
      aSrt.style.opacity = "0.35";
      aTxt.style.pointerEvents = "none";
      aSrt.style.pointerEvents = "none";
    }

    const rerun = document.createElement("button");
    rerun.className = "rerun";
    rerun.textContent = "重跑";
    rerun.onclick = () => resumeJob(j.job_id);

    const del = document.createElement("button");
    del.className = "del";
    del.textContent = "刪除";
    del.onclick = async () => {
      if (!confirm("確定刪除？")) return;
      await fetch(`/job/${j.job_id}`, { method: "DELETE" });
      await loadHistory();
    };

    right.appendChild(aTxt);
    right.appendChild(aSrt);
    right.appendChild(rerun);
    right.appendChild(del);

    item.appendChild(left);
    item.appendChild(right);

    history.appendChild(item);
  }
}

refreshBtn.onclick = loadHistory;
loadHistory();

