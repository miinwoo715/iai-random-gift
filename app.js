document.addEventListener("DOMContentLoaded", () => {
  // ===============================
  // 1. 기본 설정 및 DOM 요소 가져오기
  // ===============================
  const nameSelect = document.getElementById("myName");
  const startBtn = document.getElementById("submitBtn");
  const msg = document.getElementById("msg");
  const container = document.querySelector(".container");

  // 관리자 모드 확인 (?admin=1)
  const isAdmin = new URLSearchParams(window.location.search).get("admin") === "1";

  // Firebase 설정
  const db = firebase.database();
  const stateRef = db.ref("state");

  // ===============================
  // 2. 전역 변수 (상태 관리)
  // ===============================
  let phase = "WAIT";       // 현재 진행 상태
  let giftPool = [];        // 전체 선물 데이터
  let rerollTargets = [];   // 재추첨 대상 목록
  let lastShownKey = null;  // 애니메이션 중복 방지용

  // ===============================
  // 3. 헬퍼 함수들 (화면 그리기, 버튼 관리)
  // ===============================

  // [화면 갱신] 결과를 화면에 그려주는 함수 (슬롯머신 포함)
  function renderResult() {
    const name = nameSelect.value;
    
    // 이름이 선택 안 됐으면 화면 비우기
    if (!name) {
      msg.innerHTML = "";
      lastShownKey = null;
      return;
    }

    // 내 이름으로 된 선물 찾기
    const gift = giftPool.find(g => g.assignedTo === name);

    if (gift) {
      // 이미 화면에 보여진 번호라면 애니메이션 없이 바로 표시 (새로고침 등)
      if (gift.key === lastShownKey) {
        msg.innerHTML = getResultHTML(gift.key, gift.hint);
        updateButtons(true); // 버튼은 '추첨 완료' 상태로
        return;
      }

      // 🔥 [애니메이션 시작] 새로운 선물이면 슬롯머신 가동!
      lastShownKey = gift.key;
      
      // 1) "추첨중..." 화면 표시
      msg.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <h1 id="slotMachine" style="
            color: #fff; 
            font-size: 50px; 
            margin: 20px 0; 
            text-shadow: 4px 4px 0 #000;
            font-family: 'Press Start 2P', cursive;
          ">00</h1>
          <div style="color: #00d9ff; font-size: 14px;">운명의 선물을 찾는 중...</div>
        </div>
      `;

      // 2) 숫자 마구 돌리기 (약 1.5초)
      const slotElement = document.getElementById("slotMachine");
      let steps = 0;
      const maxSteps = 20; // 숫자가 바뀌는 횟수
      
      const interval = setInterval(() => {
        // 11~23 사이 랜덤 숫자 표시 (연출용)
        const randomNum = Math.floor(Math.random() * (23 - 11 + 1)) + 11; 
        if(slotElement) slotElement.innerText = `NO. ${randomNum}`;
        
        steps++;
        
        // 3) 애니메이션 끝! 진짜 결과 보여주기
        if (steps > maxSteps) {
          clearInterval(interval);
          msg.innerHTML = getResultHTML(gift.key, gift.hint);
          
          // 펑! 효과 (CSS 애니메이션용 클래스가 있다면 적용됨)
          const finalTitle = msg.querySelector("h1");
          if(finalTitle) {
            finalTitle.style.transition = "transform 0.2s";
            finalTitle.style.transform = "scale(1.3)";
            setTimeout(() => { finalTitle.style.transform = "scale(1)"; }, 200);
          }
        }
      }, 70); // 0.07초마다 숫자 변경

      updateButtons(true); // 버튼 비활성화

    } else {
      // 선물이 없으면 메시지 끄고 버튼 상태 복구
      msg.innerHTML = "";
      lastShownKey = null;
      updateButtons(false);
    }
  }

  // [HTML 생성] 최종 결과 화면 HTML
  function getResultHTML(key, hint) {
    return `
        <div style="text-align: center; animation: fadeIn 0.5s;">
          <div style="font-size: 12px; color: #aaa; margin-bottom: 5px;">
            축하합니다! 당신의 선물은...
          </div>
          <h1 style="
            color: #ffd700; 
            font-size: 50px; 
            margin: 15px 0; 
            text-shadow: 4px 4px 0 #000;
            font-family: 'Press Start 2P', cursive;
          ">
            NO. ${key}
          </h1>
          <div style="
            margin-top: 15px;
            padding: 20px;
            background: rgba(0, 0, 0, 0.4);
            border: 3px solid #00d9ff;
            box-shadow: 4px 4px 0 rgba(0,0,0,0.2);
            color: #fff;
            font-size: 16px;
            line-height: 1.6;
            word-break: keep-all; 
            border-radius: 4px;
          ">
            ${hint}
          </div>
        </div>
      `;
  }

  // [버튼 상태] 추첨 가능 여부에 따라 버튼 제어 (수정됨)
  function updateButtons(hasGift) {
    // 1. 이미 선물을 뽑은 경우
    if (hasGift) {
      startBtn.disabled = true;
      startBtn.innerText = "추첨 완료";
      startBtn.style.opacity = "0.6"; // 흐리게
      return;
    }

    // 2. 아직 추첨 시간(DRAW)이 아닌 경우
    if (phase !== "DRAW") {
      startBtn.disabled = true;
      startBtn.innerText = "대기 중";
      startBtn.style.opacity = "0.6";
      return;
    }

    // 3. [추가된 부분] 이름을 선택하지 않은 경우
    if (nameSelect.value === "") {
      startBtn.disabled = true;
      startBtn.innerText = "이름을 선택하세요";
      startBtn.style.opacity = "0.6";
      return;
    }

    // 4. 모든 조건 통과 (추첨 가능)
    startBtn.disabled = false;
    startBtn.innerText = "추첨 시작";
    startBtn.style.opacity = "1"; // 선명하게
  }

  // ===============================
  // 4. 초기 데이터 로드 (DB 생성용)
  // ===============================
  stateRef.once("value").then(snapshot => {
    if (snapshot.exists()) return;

    stateRef.set({
      phase: "WAIT",
      rerollTargets: [],
      // config.js의 데이터를 사용하여 DB 초기화
      giftPool: CONFIG.gifts.map(g => ({
        key: g.key,
        hint: g.hint,
        assignedTo: null
      }))
    });
  });

  // ===============================
  // 5. 이벤트 리스너 (실시간 감지)
  // ===============================

  // [DB 감지] 서버 상태가 바뀌면 자동으로 실행
  stateRef.on("value", snapshot => {
    const state = snapshot.val();
    if (!state) return;

    phase = state.phase;
    giftPool = state.giftPool || [];
    rerollTargets = state.rerollTargets || [];

    // 재추첨 버튼 표시 로직
    const name = nameSelect.value;
    if (phase === "REROLL" && rerollTargets.includes(name)) {
      rerollBtn.style.display = "block";
    } else {
      rerollBtn.style.display = "none";
    }

    // 화면 갱신
    renderResult();
  });

  // [사용자 입력 감지] 이름을 바꿀 때마다 결과 확인
  nameSelect.addEventListener("change", () => {
    renderResult();
    
    // 재추첨 버튼 상태도 다시 확인
    if (phase === "REROLL" && rerollTargets.includes(nameSelect.value)) {
      rerollBtn.style.display = "block";
    } else {
      rerollBtn.style.display = "none";
    }
  });

  // ===============================
  // 6. 추첨 로직 (트랜잭션)
  // ===============================
  startBtn.addEventListener("click", () => {
    const name = nameSelect.value;
    
    // 버튼이 비활성화 상태거나 이름이 없으면 클릭 무시 (안전장치)
    if (startBtn.disabled || !name) return;
    if (!name) {
      return;
    }

    stateRef.transaction(state => {
      // 유효성 검사
      if (!state || state.phase !== "DRAW") return state; // 추첨 시간 아님
      const already = state.giftPool.find(g => g.assignedTo === name);
      if (already) return state; // 이미 뽑음

      // 남은 선물 찾기
      const available = state.giftPool.filter(g => !g.assignedTo);
      if (available.length === 0) return state; // 선물 동남

      // 랜덤 뽑기
      const gift = available[Math.floor(Math.random() * available.length)];
      gift.assignedTo = name;

      return state;
    });
  });

  // ===============================
  // 7. 재추첨 버튼 (사용자용)
  // ===============================
  const rerollBtn = document.createElement("button");
  rerollBtn.innerText = "재추첨 기회 사용!";
  rerollBtn.style.display = "none";
  rerollBtn.style.background = "#e94560"; // 빨간색 강조
  rerollBtn.style.marginTop = "10px";
  container.appendChild(rerollBtn);

  rerollBtn.onclick = () => {
    const name = nameSelect.value;
    if(!confirm("정말 재추첨 하시겠습니까?")) return;

    stateRef.transaction(state => {
      if (!state) return state;
      if (state.phase !== "REROLL") return state;
      if (!state.rerollTargets.includes(name)) return state;

      // 기존 선물 반납
      const prev = state.giftPool.find(g => g.assignedTo === name);
      if (prev) prev.assignedTo = null;

      // 다시 뽑기
      const available = state.giftPool.filter(g => !g.assignedTo);
      if (available.length === 0) return state;

      const gift = available[Math.floor(Math.random() * available.length)];
      gift.assignedTo = name;

      // 재추첨권 소멸 (1회 한정)
      state.rerollTargets = state.rerollTargets.filter(n => n !== name);

      return state;
    });
  };

  // ===============================
  // 8. 관리자 UI (?admin=1)
  // ===============================
  if (isAdmin) {
    const adminContainer = document.createElement("div");
    adminContainer.style.marginTop = "30px";
    adminContainer.style.borderTop = "2px dashed #555";
    adminContainer.style.paddingTop = "20px";
    container.appendChild(adminContainer);

    // [전체 리셋 버튼]
    const resetBtn = document.createElement("button");
    resetBtn.innerText = "⚠️ 전체 리셋 (DB초기화)";
    resetBtn.style.background = "#c0392b";
    resetBtn.style.fontSize = "12px";
    resetBtn.style.padding = "10px";
    
    resetBtn.onclick = () => {
      if (!confirm("🚨 정말로 모든 데이터를 초기화하시겠습니까?\n(이미 뽑은 선물 정보가 다 사라집니다)")) return;

      // 🔥 config.js 내용을 DB에 반영
      stateRef.set({
        phase: "WAIT",
        rerollTargets: [],
        giftPool: CONFIG.gifts.map(g => ({
          key: g.key,
          hint: g.hint,
          assignedTo: null
        }))
      });

      alert("초기화 완료! config.js 내용이 반영되었습니다.");
    };
    adminContainer.appendChild(resetBtn);

    // [전체 추첨 시작 버튼]
    const adminStartBtn = document.createElement("button");
    adminStartBtn.innerText = "▶ 전체 추첨 모드 시작";
    adminStartBtn.style.background = "#27ae60";
    adminStartBtn.style.fontSize = "12px";
    adminStartBtn.style.padding = "10px";
    adminStartBtn.onclick = () => {
      stateRef.update({ phase: "DRAW" });
      alert("추첨 모드로 변경되었습니다. 이제 참가자들이 버튼을 누를 수 있습니다.");
    };
    adminContainer.appendChild(adminStartBtn);

    // [재추첨 관리 패널]
    const adminBox = document.createElement("div");
    adminBox.style.marginTop = "20px";
    adminContainer.appendChild(adminBox);

    stateRef.on("value", snapshot => {
      const state = snapshot.val();
      if (!state || state.phase !== "DRAW") return; // DRAW 상태일 때만 재추첨 설정 가능

      adminBox.innerHTML = "<h4 style='color:#fff'>재추첨 대상자 선택</h4>";
      
      const listContainer = document.createElement("div");
      listContainer.style.textAlign = "left";
      listContainer.style.padding = "10px";
      listContainer.style.background = "rgba(0,0,0,0.3)";

      state.giftPool.forEach(g => {
        if (g.assignedTo) {
          const row = document.createElement("div");
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.value = g.assignedTo;
          cb.id = `chk_${g.assignedTo}`;
          
          const label = document.createElement("label");
          label.htmlFor = `chk_${g.assignedTo}`;
          label.style.display = "inline";
          label.style.marginLeft = "5px";
          label.innerText = `${g.assignedTo} (현재: ${g.key}번)`;

          row.appendChild(cb);
          row.appendChild(label);
          listContainer.appendChild(row);
        }
      });
      adminBox.appendChild(listContainer);

      const doRerollBtn = document.createElement("button");
      doRerollBtn.innerText = "선택한 사람 재추첨 모드 실행";
      doRerollBtn.style.background = "#e67e22";
      doRerollBtn.style.fontSize = "12px";
      
      // [수정됨] 관리자가 재추첨 실행 버튼을 눌렀을 때
      doRerollBtn.onclick = () => {
        const selected = [...listContainer.querySelectorAll("input:checked")].map(cb => cb.value);
        if(selected.length === 0) {
            alert("재추첨할 사람을 선택해주세요.");
            return;
        }

        // 🔥 핵심 변경사항: Transaction을 사용하여 상태를 한방에 변경
        stateRef.transaction(state => {
          if (!state) return state;

          // 1. 선택된 사람들의 선물을 강제로 '압수' (assignedTo = null)
          // 이렇게 해야 바닥(available pool)에 선물들이 쌓이고 섞입니다.
          state.giftPool.forEach(g => {
            if (selected.includes(g.assignedTo)) {
              g.assignedTo = null; 
            }
          });

          // 2. 상태 변경
          state.phase = "REROLL";
          state.rerollTargets = selected;

          return state;
        });

        alert(`${selected.join(", ")} 님의 선물을 회수했습니다!\n이제 해당 참가자들이 버튼을 누르면 섞인 선물 중에서 뽑습니다.`);
      };
      
      adminBox.appendChild(doRerollBtn);
    });
  }

});