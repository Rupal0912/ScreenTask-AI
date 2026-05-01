document.addEventListener("DOMContentLoaded", () => {

  const status = document.getElementById("status");
  const fullBtn = document.getElementById("fullBtn");

  // 🔴 FULL PAGE CAPTURE
  fullBtn.addEventListener("click", async () => {
    try {
      status.textContent = "📸 Capturing & processing...";
      fullBtn.disabled = true;

      await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: "captureScreenshot" },
          () => resolve()
        );
      });
showCapturePopup();
showToast("Tasks extracted!");
      // status.textContent = "✅ Tasks extracted!";

      // refresh tasks after slight delay
      setTimeout(() => {
        loadTasks();
        status.textContent = "";
        fullBtn.disabled = false;
      }, 1200);

    } catch (error) {
      console.error("Screenshot error:", error);
      status.textContent = "❌ Failed";
      fullBtn.disabled = false;
    }
  });


  // 🔴 REGION SELECT
  document.getElementById("regionBtn").addEventListener("click", async () => {

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    await chrome.tabs.sendMessage(tab.id, {
      action: "startSelection",
    });

    window.close(); // correct behavior
  });


  loadTasks(); // initial load
});


// 🔴 LOAD TASKS
async function loadTasks() {
  const container = document.getElementById("tasks");

  try {
    container.innerHTML = "<p>Loading...</p>";

    const res = await fetch("https://screentask-ai.onrender.com/tasks");
    const data = await res.json();

    const tasks = data.tasks || [];
    const intent = tasks[0]?.intent || "";
    tasks.sort((a, b) => {
  const order = { high: 1, medium: 2, low: 3 };
  return order[a.priority] - order[b.priority];
});

    if (!tasks.length) {
      // container.innerHTML = "<p>No tasks yet</p>";
      container.innerHTML = `
  <div style="text-align:center; opacity:0.7; font-size:13px; padding:20px;">
    📸 Capture something to extract tasks
  </div>
`;
      document.querySelector(".count").textContent = "0 tasks";
      return;
    }

    container.innerHTML = `
  ${intent ? `<div style="margin-bottom:10px; font-weight:bold;">🧠 ${intent}</div>` : ""}
` + tasks.map(task => `
      <div class="task-card ${task.priority} new-task">

        <div class="badge">
          ${task.priority.toUpperCase()}
        </div>

        <div class="task-title ${task.completed ? 'done' : ''}">
          ${task.title}
        </div>

        <div class="task-meta">
  📅 ${task.deadline || "No deadline"}
</div>

${task.steps && task.steps.length > 0 ? `
  <ul style="margin-top:6px; padding-left:15px; font-size:12px;">
    ${task.steps.map(step => `<li>${step}</li>`).join("")}
  </ul>
` : ""}



        <div class="actions">
          <div class="action-btn complete-btn" data-id="${task._id}" data-status="${task.completed}">
            ${task.completed ? "↺" : "✔"}
          </div>

          <div class="action-btn delete-btn" data-id="${task._id}">
            ✕
          </div>
        </div>

      </div>
    `).join("");

    // update count
    document.querySelector(".count").textContent = `${tasks.length} tasks`;

    // hover effect
    document.querySelectorAll(".task-card").forEach(card => {
      card.addEventListener("mouseenter", () => {
        card.style.boxShadow = "0 20px 40px rgba(0,0,0,0.5)";
      });

      card.addEventListener("mouseleave", () => {
        card.style.boxShadow = "";
      });
    });

  
   document.querySelectorAll(".delete-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const id = btn.getAttribute("data-id");
    const card = btn.closest(".task-card");

    // smooth remove
    card.style.transition = "0.3s";
    card.style.opacity = "0";
    card.style.transform = "translateX(40px)";

    setTimeout(() => {
      card.remove(); // 🔥 NO reload
    }, 300);

    await deleteTask(id);

    // update count manually
    const countEl = document.querySelector(".count");
    const current = parseInt(countEl.textContent);
    countEl.textContent = `${current - 1} tasks`;
  });
});


document.querySelectorAll(".complete-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const id = btn.getAttribute("data-id");
    const card = btn.closest(".task-card");
    const title = card.querySelector(".task-title");

    const current = btn.getAttribute("data-status") === "true";

    // 🔥 instant UI update (no reload)
    title.classList.toggle("done");
    btn.textContent = current ? "✔" : "↺";
    btn.setAttribute("data-status", !current);

    // slight feedback
    card.style.transform = "scale(0.98)";
    setTimeout(() => {
      card.style.transform = "";
    }, 150);

    // backend sync
    await toggleComplete(id, !current);
  });
});

  } catch (err) {
    container.innerHTML = "<p>Error loading tasks</p>";
    console.error(err);
  }
}


// 🔴 DELETE
async function deleteTask(id) {
  try {
    await fetch(`https://screentask-ai.onrender.com/task/${id}`, {
      method: "DELETE"
    });

    // loadTasks();
  } catch (err) {
    console.error("Delete error:", err);
  }
}


// 🔴 TOGGLE COMPLETE
async function toggleComplete(id, status) {
  try {
    await fetch(`https://screentask-ai.onrender.com/task/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ completed: status })
    });

    // loadTasks();
  } catch (err) {
    console.error("Toggle error:", err);
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

function showCapturePopup() {
  const div = document.createElement("div");
  div.textContent = "📸 Screenshot captured";

  div.style.position = "fixed";
  div.style.top = "10px";
  // div.style.right = "10px";
  div.style.left = "50%";
div.style.transform = "translateX(-50%)";
  div.style.background = "#111";
  div.style.color = "#fff";
  div.style.padding = "8px 12px";
  div.style.borderRadius = "8px";
  div.style.fontSize = "12px";
  div.style.zIndex = "9999";
  div.style.opacity = "0";
  div.style.transition = "0.3s";

  document.body.appendChild(div);

  setTimeout(() => div.style.opacity = "1", 50);

  setTimeout(() => {
    div.style.opacity = "0";
    setTimeout(() => div.remove(), 300);
  }, 1500);
}