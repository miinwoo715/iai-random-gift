document.addEventListener("DOMContentLoaded", () => {
  // ===============================
  // DOM
  // ===============================
  const nameSelect = document.getElementById("myName");
  const startBtn = document.getElementById("submitBtn");
  const msg = document.getElementById("msg");
  const container = document.querySelector(".container");

  // ===============================
  // 관리자 여부 (?admin=1)
  // ===============================
  const isAdmin =
    new URLSearchParams(window.location.search).get("admin") === "1";

  // ===============================
  // Firebase DB
  // ===============================
  const db = firebase.database();
  const stateRef = db.ref("state");

  // ===============================
  // 초기 상태 (서버에 없을 때만 생성)
  // ===============================
  stateRef.once("value").then(snapshot => {
    if (snapshot.exists()) return;

    stateRef.set({
      phase: "WAIT", // WAIT | DRAW | REROLL
      rerollTargets: [],
      giftPool: CONFIG.gifts.map(g => ({
        key: g.key,
        hint: g.hint,
        assignedTo: null
      }))
    });
  });

  // ===============================
  // 실시간 상태 구독
  // ===============================
  let phase = "WAIT";
  let giftPool = [];
  let rerollTargets = [];

  stateRef.on("value", snapshot => {
    const state = snapshot.val();
    if (!state) return;

    phase = state.phase;
    giftPool = state.giftPool;
    rerollTargets = state.rerollTargets || [];

    // 버튼 제어
    startBtn.disabled = phase !== "DRAW";

    // 재추첨 버튼 표시 여부
    const name = nameSelect.value;
    if (phase === "REROLL" && rerollTargets.includes(name)) {
      rerollBtn.style.display = "block";
    }
  });

  // ===============================
  // 추첨 버튼
  // ===============================
  startBtn.addEventListener("click", () => {
    const name = nameSelect.value;
    if (!name) {
      msg.innerText = "이름부터 선택하세요.";
      return;
    }

    stateRef.transaction(state => {
      if (!state || state.phase !== "DRAW") return state;

      const already = state.giftPool.find(g => g.assignedTo === name);
      if (already) return state;

      const available = state.giftPool.filter(g => !g.assignedTo);
      if (available.length === 0) return state;

      const gift =
        available[Math.floor(Math.random() * available.length)];
      gift.assignedTo = name;

      return state;
    });
  });

  // ===============================
  // 힌트 표시
  // ===============================
  stateRef.on("value", snapshot => {
    const state = snapshot.val();
    if (!state) return;

    const name = nameSelect.value;
    if (!name) return;

    const gift = state.giftPool.find(g => g.assignedTo === name);
    if (gift) {
      msg.innerHTML = `
        <div style="
          font-size: 18px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 150px;
          text-align: center;
        ">
          “${gift.hint}”
        </div>
      `;

    }
  });

  // ===============================
  // 재추첨 버튼 (참가자)
  // ===============================
  const rerollBtn = document.createElement("button");
  rerollBtn.innerText = "재추첨";
  rerollBtn.style.display = "none";
  container.appendChild(rerollBtn);

  rerollBtn.onclick = () => {
    const name = nameSelect.value;

    stateRef.transaction(state => {
      if (!state) return state;
      if (state.phase !== "REROLL") return state;
      if (!state.rerollTargets.includes(name)) return state;

      const prev = state.giftPool.find(g => g.assignedTo === name);
      if (prev) prev.assignedTo = null;

      const available = state.giftPool.filter(g => !g.assignedTo);
      if (available.length === 0) return state;

      const gift =
        available[Math.floor(Math.random() * available.length)];
      gift.assignedTo = name;

      // 재추첨 1회 제한
      state.rerollTargets = state.rerollTargets.filter(n => n !== name);

      return state;
    });

    rerollBtn.disabled = true;
  };

  // ===============================
  // 관리자 UI
  // ===============================
  if (isAdmin) {
    // 전체 리셋 버튼 (테스트용)
    const resetBtn = document.createElement("button");
    resetBtn.innerText = "전체 리셋 (테스트용)";
    resetBtn.style.background = "#c0392b";
    resetBtn.style.color = "white";

    resetBtn.onclick = () => {
      if (!confirm("진짜 전부 초기화할까?")) return;

      stateRef.set({
        phase: "WAIT",
        rerollTargets: [],
        giftPool: [
          { key: 11, hint: "11번 힌트입니다.", assignedTo: null },
          { key: 12, hint: "12번 힌트입니다.", assignedTo: null },
          { key: 13, hint: "13번 힌트입니다.", assignedTo: null },
          { key: 14, hint: "14번 힌트입니다.", assignedTo: null },
          { key: 15, hint: "15번 힌트입니다.", assignedTo: null },
          { key: 16, hint: "16번 힌트입니다.", assignedTo: null },
          { key: 17, hint: "17번 힌트입니다.", assignedTo: null },
          { key: 18, hint: "18번 힌트입니다.", assignedTo: null },
          { key: 19, hint: "19번 힌트입니다.", assignedTo: null },
          { key: 20, hint: "20번 힌트입니다.", assignedTo: null },
          { key: 21, hint: "21번 힌트입니다.", assignedTo: null },
          { key: 22, hint: "22번 힌트입니다.", assignedTo: null },
          { key: 23, hint: "23번 힌트입니다.", assignedTo: null }
        ]
      });

      alert("초기화 완료");
    };

    container.appendChild(resetBtn);


    // 전체 추첨 시작
    const adminStartBtn = document.createElement("button");
    adminStartBtn.innerText = "전체 추첨 시작";
    adminStartBtn.onclick = () => {
      stateRef.update({ phase: "DRAW" });
      alert("전체 추첨 시작");
    };
    container.appendChild(adminStartBtn);

    // 재추첨 대상 선택
    const adminBox = document.createElement("div");
    adminBox.innerHTML = "<h4>재추첨 대상 선택</h4>";
    container.appendChild(adminBox);

    stateRef.on("value", snapshot => {
      const state = snapshot.val();
      if (!state || state.phase !== "DRAW") return;

      adminBox.innerHTML = "<h4>재추첨 대상 선택</h4>";

      state.giftPool.forEach(g => {
        if (g.assignedTo) {
          const label = document.createElement("label");
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.value = g.assignedTo;
          label.appendChild(cb);
          label.append(` ${g.assignedTo}`);
          adminBox.appendChild(label);
          adminBox.appendChild(document.createElement("br"));
        }
      });

      const rerollStartBtn = document.createElement("button");
      rerollStartBtn.innerText = "재추첨 시작";
      rerollStartBtn.onclick = () => {
        const selected = [
          ...adminBox.querySelectorAll("input:checked")
        ].map(cb => cb.value);

        stateRef.update({
          phase: "REROLL",
          rerollTargets: selected
        });

        alert("재추첨 시작");
      };

      adminBox.appendChild(rerollStartBtn);
    });
  }
});
