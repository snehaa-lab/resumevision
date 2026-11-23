/* ============================================================
   AI Resume Analyzer — frontend logic
   Talks to the existing Flask API:
     POST /api/analyze  (multipart: resume file + optional job_description)
   No backend changes required.
   ============================================================ */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const MAX_SIZE = 8 * 1024 * 1024; // must match backend MAX_CONTENT_LENGTH
  const ALLOWED = ["pdf", "docx", "txt"];

  /* ---------------- Nav ---------------- */
  const nav = $("site-nav");
  const navToggle = $("nav-toggle");
  const navMenu = $("nav-menu");

  window.addEventListener("scroll", () => {
    nav.classList.toggle("scrolled", window.scrollY > 8);
  }, { passive: true });

  navToggle.addEventListener("click", () => {
    const open = navMenu.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });
  navMenu.addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      navMenu.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });

  /* ---------------- Scroll reveals ---------------- */
  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -32px 0px" });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  /* ---------------- Hero paper tilt ---------------- */
  const heroVisual = $("hero-visual");
  const hvPaper = $("hv-paper");
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  if (heroVisual && hvPaper && finePointer && !reduceMotion) {
    let raf = null;
    heroVisual.addEventListener("pointermove", (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const rect = heroVisual.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        hvPaper.style.transform =
          `rotate(-3deg) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg)`;
        raf = null;
      });
    });
    heroVisual.addEventListener("pointerleave", () => {
      hvPaper.style.transform = "rotate(-3deg)";
    });
  }

  /* ---------------- File intake ---------------- */
  const form = $("analyze-form");
  const fileInput = $("resume-file");
  const dropzone = $("dropzone");
  const dzEmpty = $("dz-empty");
  const dzFile = $("dz-file");
  const dzActions = $("dz-actions");
  const dzError = $("dz-error");
  const fileNameEl = $("file-name");
  const fileSizeEl = $("file-size");
  const fileKindEl = $("file-kind");
  const stepJd = $("step-jd");
  const jdTextarea = $("job-description");
  const jdCount = $("jd-count");
  const submitBtn = $("submit-btn");

  let selectedFile = null;
  let dragDepth = 0;

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  }

  function fileExt(name) {
    const i = name.lastIndexOf(".");
    return i === -1 ? "" : name.slice(i + 1).toLowerCase();
  }

  function showDzError(msg) {
    dzError.textContent = msg;
    dzError.classList.remove("hidden");
  }
  function clearDzError() {
    dzError.textContent = "";
    dzError.classList.add("hidden");
  }

  function acceptFile(file) {
    clearDzError();
    if (!file) return;
    const ext = fileExt(file.name);
    if (!ALLOWED.includes(ext)) {
      showDzError("That file type isn't supported. Please upload a PDF, DOCX or TXT file.");
      return;
    }
    if (file.size > MAX_SIZE) {
      showDzError("This file is larger than 8 MB. Please upload a smaller version.");
      return;
    }
    if (file.size === 0) {
      showDzError("This file appears to be empty.");
      return;
    }

    selectedFile = file;
    fileNameEl.textContent = file.name;
    fileSizeEl.textContent = formatSize(file.size) + " · ready to analyze";
    fileKindEl.textContent = ext.toUpperCase();

    dzEmpty.classList.add("hidden");
    dzFile.classList.remove("hidden");
    dzActions.classList.remove("hidden");
    dropzone.classList.add("has-file");

    // Unlock step 02
    stepJd.classList.remove("locked");
    jdTextarea.disabled = false;
    submitBtn.disabled = false;
  }

  function clearFile() {
    selectedFile = null;
    fileInput.value = "";
    dzFile.classList.add("hidden");
    dzActions.classList.add("hidden");
    dzEmpty.classList.remove("hidden");
    dropzone.classList.remove("has-file");
    clearDzError();

    stepJd.classList.add("locked");
    jdTextarea.disabled = true;
    submitBtn.disabled = true;
  }

  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) acceptFile(fileInput.files[0]);
  });

  // Clicking the dropzone once a file is loaded shouldn't reopen the picker;
  // use the explicit Replace button instead.
  dropzone.addEventListener("click", (e) => {
    if (selectedFile) e.preventDefault();
  });

  $("file-replace").addEventListener("click", () => {
    fileInput.value = "";
    fileInput.click();
  });
  $("file-remove").addEventListener("click", clearFile);

  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      if (evt === "dragenter") dragDepth++;
      dropzone.classList.add("dragover");
    })
  );
  dropzone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropzone.classList.remove("dragover");
  });
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files.length) acceptFile(e.dataTransfer.files[0]);
  });

  /* ---------------- Job description ---------------- */
  jdTextarea.addEventListener("input", () => {
    const n = jdTextarea.value.length;
    jdCount.textContent = n.toLocaleString() + (n === 1 ? " character" : " characters");
  });

  /* ---------------- Panel states ---------------- */
  const intakeWrap = $("intake-wrap");
  const loadingPanel = $("loading-panel");
  const errorPanel = $("error-panel");
  const errorMessage = $("error-message");
  const results = $("results");

  function showIntake() {
    intakeWrap.classList.remove("hidden");
    loadingPanel.classList.add("hidden");
    errorPanel.classList.add("hidden");
  }
  function showLoading() {
    intakeWrap.classList.add("hidden");
    errorPanel.classList.add("hidden");
    loadingPanel.classList.remove("hidden");
  }
  function showError(msg) {
    errorMessage.textContent = msg;
    intakeWrap.classList.add("hidden");
    loadingPanel.classList.add("hidden");
    errorPanel.classList.remove("hidden");
  }
  $("error-retry").addEventListener("click", showIntake);

  /* ---------------- Loading animation ----------------
     The backend returns one response with no step-level status,
     so stages illustrate the process (clearly labelled as such)
     and the elapsed timer is real. No fake completion claims. */
  const stageItems = Array.from(document.querySelectorAll("#load-stages li"));
  const elapsedEl = $("load-elapsed");
  let stageTimer = null;
  let elapsedTimer = null;

  function startLoading() {
    let stage = 0;
    let seconds = 0;
    stageItems.forEach((li, i) => li.classList.toggle("active", i === 0));
    elapsedEl.textContent = "0:00";

    stageTimer = setInterval(() => {
      stage = (stage + 1) % stageItems.length;
      stageItems.forEach((li, i) => li.classList.toggle("active", i === stage));
    }, 2600);

    elapsedTimer = setInterval(() => {
      seconds++;
      const m = Math.floor(seconds / 60);
      const s = String(seconds % 60).padStart(2, "0");
      elapsedEl.textContent = m + ":" + s;
    }, 1000);
  }
  function stopLoading() {
    clearInterval(stageTimer);
    clearInterval(elapsedTimer);
    stageTimer = elapsedTimer = null;
  }

  /* ---------------- Submit ---------------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showDzError("Please choose a resume file first.");
      return;
    }

    const hadJD = jdTextarea.value.trim().length > 0;
    const formData = new FormData();
    formData.append("resume", selectedFile);
    if (hadJD) formData.append("job_description", jdTextarea.value.trim());

    showLoading();
    startLoading();
    submitBtn.disabled = true;

    try {
      let res;
      try {
        res = await fetch("/api/analyze", { method: "POST", body: formData });
      } catch (err) {
        showError("Couldn't reach the server. Check your connection and try again.");
        return;
      }

      // Render's proxy can return an HTML error page (e.g. while a free
      // instance is waking up). Parse defensively and explain what happened.
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        if (res.status >= 500) {
          showError(
            "The server is temporarily unavailable (HTTP " + res.status + "). " +
            "On the free plan, Render wakes a sleeping service on the first " +
            "request — please wait a moment and press Try again."
          );
        } else {
          showError("The server returned an unexpected response (HTTP " + res.status + "). Please try again.");
        }
        return;
      }

      if (!res.ok) {
        showError(data.error || "Something went wrong. Please try again.");
        return;
      }

      renderReport(data.result, hadJD);
      showIntake();
      results.classList.remove("hidden");
      results.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    } catch (err) {
      showError("Something went wrong. Please try again.");
    } finally {
      stopLoading();
      submitBtn.disabled = !selectedFile;
    }
  });

  /* ---------------- Report rendering ---------------- */
  function clampScore(score) {
    const n = Number(score);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function renderReport(r, hadJD) {
    $("candidate-name").textContent = r.candidate_name || "Your resume";
    $("experience-level").textContent = r.estimated_experience_level || "";
    $("report-date").textContent = new Date().toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric",
    });
    $("score-reasoning").textContent = r.ats_score_reasoning || "";
    $("overall-summary").textContent = r.overall_summary || "";

    $("targeted-ribbon").classList.toggle("hidden", !hadJD);
    $("gaps-sub").textContent = hadJD
      ? "Terms your target role asks for that your resume doesn't mention yet."
      : "Add a job description next time to unlock role-specific keyword gaps.";

    setScore(clampScore(r.ats_score));

    renderTags("skills-technical", r.extracted_skills && r.extracted_skills.technical, "");
    renderTags("skills-tools", r.extracted_skills && r.extracted_skills.tools_and_technologies, "alt");
    renderTags("skills-soft", r.extracted_skills && r.extracted_skills.soft, "soft");
    renderTags("keyword-gaps", r.keyword_gaps, "gap");

    renderPlainList("sections-found", r.sections_found);
    renderPlainList("sections-missing", r.missing_sections);
    renderStrengths(r.strengths);
    renderWeakSections(r.weak_sections);
    renderSuggestions(r.improvement_suggestions);
    renderQuestions(r.interview_questions);

    // Reset tabs to the first category on each new report
    activateTab("technical");
  }

  /* --- Animated score ring + count-up --- */
  function setScore(score) {
    const ring = $("score-ring-fill");
    const numberEl = $("score-number");
    const verdict = $("score-verdict");

    let color, text;
    if (score >= 75) {
      color = "#5F7A4E";
      text = "In strong shape — polish, don't rebuild.";
    } else if (score >= 45) {
      color = "#C99B3F";
      text = "Getting there — a few honest edits away.";
    } else {
      color = "#E85B45";
      text = "Room to grow — let's refine it together.";
    }
    verdict.textContent = text;
    ring.style.stroke = color;

    const targetOffset = 100 - score;
    if (reduceMotion) {
      ring.style.strokeDashoffset = targetOffset;
      numberEl.textContent = score;
      return;
    }

    // Restart the ring animation from empty
    ring.style.transition = "none";
    ring.style.strokeDashoffset = 100;
    void ring.getBoundingClientRect(); // force reflow
    ring.style.transition = "";
    requestAnimationFrame(() => {
      ring.style.strokeDashoffset = targetOffset;
    });

    const duration = 1400;
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      numberEl.textContent = Math.round(eased * score);
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* --- Small render helpers (textContent only — no HTML injection) --- */
  function renderTags(elementId, items, variant) {
    const el = $(elementId);
    el.innerHTML = "";
    if (!items || !items.length) {
      const note = document.createElement("span");
      note.className = "empty-note";
      note.textContent = "None detected";
      el.appendChild(note);
      return;
    }
    items.forEach((item) => {
      const span = document.createElement("span");
      span.className = "tag" + (variant ? " " + variant : "");
      span.textContent = item;
      el.appendChild(span);
    });
  }

  function renderPlainList(elementId, items) {
    const el = $(elementId);
    el.innerHTML = "";
    if (!items || !items.length) {
      const li = document.createElement("li");
      li.className = "empty-note";
      li.textContent = "None";
      el.appendChild(li);
      return;
    }
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      el.appendChild(li);
    });
  }

  function renderStrengths(items) {
    const el = $("strengths-list");
    el.innerHTML = "";
    if (!items || !items.length) {
      const li = document.createElement("li");
      li.className = "empty-note";
      li.textContent = "No specific strengths returned.";
      el.appendChild(li);
      return;
    }
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      el.appendChild(li);
    });
  }

  function renderWeakSections(items) {
    const el = $("weak-sections");
    el.innerHTML = "";
    if (!items || !items.length) {
      const p = document.createElement("p");
      p.className = "empty-note";
      p.textContent = "No significantly weak sections detected — nicely done.";
      el.appendChild(p);
      return;
    }
    items.forEach((item, idx) => {
      const wrap = document.createElement("div");
      wrap.className = "weak-item" + (idx === 0 ? " open" : "");

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "weak-toggle";
      toggle.setAttribute("aria-expanded", idx === 0 ? "true" : "false");

      const title = document.createElement("span");
      title.textContent = item.section || "Section";
      const chev = document.createElement("span");
      chev.className = "chev";
      chev.setAttribute("aria-hidden", "true");
      chev.textContent = "▾";
      toggle.appendChild(title);
      toggle.appendChild(chev);

      const body = document.createElement("div");
      body.className = "weak-body";
      const inner = document.createElement("div");
      inner.className = "weak-body-inner";
      const content = document.createElement("div");
      content.className = "weak-body-content";

      const issue = document.createElement("p");
      issue.className = "issue";
      issue.textContent = item.issue || "";
      const fix = document.createElement("p");
      fix.className = "fix";
      const fixLabel = document.createElement("b");
      fixLabel.textContent = "Try this → ";
      fix.appendChild(fixLabel);
      fix.appendChild(document.createTextNode(item.suggestion || ""));

      content.appendChild(issue);
      content.appendChild(fix);
      inner.appendChild(content);
      body.appendChild(inner);
      wrap.appendChild(toggle);
      wrap.appendChild(body);
      el.appendChild(wrap);

      toggle.addEventListener("click", () => {
        const open = wrap.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(open));
      });
    });
  }

  function renderSuggestions(items) {
    const el = $("suggestions-list");
    el.innerHTML = "";
    if (!items || !items.length) {
      const li = document.createElement("li");
      li.className = "empty-note";
      li.textContent = "No specific suggestions returned.";
      el.appendChild(li);
      return;
    }
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      el.appendChild(li);
    });
  }

  function renderQuestions(questions) {
    ["technical", "behavioral", "role_specific"].forEach((key) => {
      const el = $("questions-" + key);
      el.innerHTML = "";
      const list = (questions && questions[key]) || [];
      if (!list.length) {
        const li = document.createElement("li");
        li.className = "empty-note";
        li.textContent = "None generated";
        el.appendChild(li);
        return;
      }
      list.forEach((q) => {
        const li = document.createElement("li");
        li.textContent = q;
        el.appendChild(li);
      });
    });
  }

  /* ---------------- Tabs ---------------- */
  const tabButtons = Array.from(document.querySelectorAll("#question-tabs .tab-btn"));
  function activateTab(tab) {
    tabButtons.forEach((b) => {
      const active = b.dataset.tab === tab;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", String(active));
    });
    ["technical", "behavioral", "role_specific"].forEach((key) => {
      $("questions-" + key).classList.toggle("hidden", key !== tab);
    });
  }
  $("question-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (btn) activateTab(btn.dataset.tab);
  });

  /* ---------------- New analysis ---------------- */
  function resetAll() {
    clearFile();
    jdTextarea.value = "";
    jdCount.textContent = "0 characters";
    results.classList.add("hidden");
    showIntake();
    document.getElementById("analyze").scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }
  $("new-analysis").addEventListener("click", resetAll);
  $("new-analysis-2").addEventListener("click", resetAll);

  /* ---------------- Footer year ---------------- */
  $("year").textContent = String(new Date().getFullYear());
})();
