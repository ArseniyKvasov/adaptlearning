const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadStatusDiv = document.getElementById('uploadStatus');
const generateBtn = document.getElementById('generateBtn');
const resetUploadBtn = document.getElementById('resetUploadBtn');
const transcriptContainer = document.getElementById('transcriptContainer');
const transcriptJumpBtn = document.getElementById('transcriptJumpBtn');
const summaryContainer = document.getElementById('summaryContainer');
const quizContainer = document.getElementById('quizContainer');
const analyticsContainer = document.getElementById('analyticsContainer');
const editSummaryBtn = document.getElementById('editSummaryBtn');
const editQuizBtn = document.getElementById('editQuizBtn');
const summaryTabBtn = document.getElementById('summaryTabBtn');
const quizTabBtn = document.getElementById('quizTabBtn');
const analyticsTabBtn = document.getElementById('analyticsTabBtn');
const historyList = document.getElementById('historyList');
const historyListMobile = document.getElementById('historyListMobile');
const historyToggleBtn = document.getElementById('historyToggleBtn');
const historySidebar = document.querySelector('.history-sidebar');
const pageLayout = document.querySelector('.page-layout');
const historyDrawer = document.getElementById('historyDrawer');
const historyOverlay = document.getElementById('historyOverlay');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');

const tabBtns = document.querySelectorAll('.tab-btn');
const panels = {
  transcript: document.getElementById('panelTranscript'),
  summary: document.getElementById('panelSummary'),
  quiz: document.getElementById('panelQuiz'),
  analytics: document.getElementById('panelAnalytics')
};

const STATUS_LABELS = {
  processing: 'Обработка...',
  completed: 'Готово',
  failed: 'Ошибка'
};

const requestedGenerationId = new URL(window.location.href).searchParams.get('generation_id') || '';

let selectedFile = null;
let meUserId = '';
let generations = [];
let activeGenerationId = null;
let neutralMode = false;
let activeSummarySubtopic = '';
const generationUiState = {};
let ws = null;
let wsReconnectTimer = null;
let wsReconnectAttempt = 0;
let transcriptJumpRaf = 0;
let requestedGenerationCache = null;

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function protectMathSegments(text) {
  const mathParts = [];
  const protectedText = (text || '').replace(/\$\$[\s\S]*?\$\$|\$[^$\n]+?\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, (match) => {
    const token = `@@MATH_${mathParts.length}@@`;
    mathParts.push(match);
    return token;
  });
  return { text: protectedText, mathParts };
}

function restoreMathSegments(text, mathParts) {
  return text.replace(/@@MATH_(\d+)@@/g, (_match, idx) => mathParts[Number(idx)] || '');
}

function normalizeTextBreaks(text) {
  return (text || '')
    .replace(/\\n/g, '\n');
}

function normalizeQuizText(text) {
  return (text || '')
    .replace(/\\n/g, '\n');
}

function showPopover(message) {
  const existing = document.querySelector('.global-popover');
  if (existing) existing.remove();
  const popover = document.createElement('div');
  popover.className = 'global-popover';
  popover.textContent = message;
  document.body.appendChild(popover);
  requestAnimationFrame(() => popover.classList.add('visible'));
  setTimeout(() => {
    popover.classList.remove('visible');
    setTimeout(() => popover.remove(), 200);
  }, 2400);
}

function renderMathInContainer(container) {
  if (!container || !window.renderMathInElement) return;
  if (!container.innerHTML.trim()) return;
  try {
    window.renderMathInElement(container, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ],
      throwOnError: false
    });
    container.querySelectorAll('.katex-display').forEach((node) => {
      if (node.parentElement && !node.parentElement.classList.contains('math-scroll-wrap')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'math-scroll-wrap';
        node.parentElement.insertBefore(wrapper, node);
        wrapper.appendChild(node);
      }
    });
  } catch (_e) {
    // ignore
  }
}

function highlightCodeInContainer(container) {
  if (!container || !window.hljs) return;
  container.querySelectorAll('pre.code-block code').forEach((block) => {
    try {
      window.hljs.highlightElement(block);
    } catch (_e) {
      // ignore
    }
  });
}

function formatDateTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function formatTime(ms) {
  const sec = Math.floor((ms || 0) / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function normalizeTranscriptLines(transcript) {
  const lines = [];
  (Array.isArray(transcript) ? transcript : []).forEach((item) => {
    if (!item) return;
    if (Array.isArray(item.transcript)) {
      item.transcript.forEach((segment) => {
        if (!segment) return;
        const startMs = Number(segment.start_ms || 0);
        const text = String(segment.text || '').trim();
        if (!text) return;
        lines.push({ start_ms: Number.isNaN(startMs) ? 0 : startMs, text });
      });
      return;
    }
    const startMs = Number(item.start_ms || 0);
    const text = String(item.text || '').trim();
    if (!text) return;
    lines.push({ start_ms: Number.isNaN(startMs) ? 0 : startMs, text });
  });
  lines.sort((a, b) => a.start_ms - b.start_ms);
  return lines;
}

function markdownInlineToHtml(text) {
  let html = escapeHtml(normalizeTextBreaks(text));
  const protectedMath = protectMathSegments(html);
  html = protectedMath.text;
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br>');
  return restoreMathSegments(html, protectedMath.mathParts);
}

function markdownInlineToHtmlQuiz(text) {
  let html = escapeHtml(normalizeQuizText(text));
  const protectedMath = protectMathSegments(html);
  html = protectedMath.text;
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br>');
  return restoreMathSegments(html, protectedMath.mathParts);
}

function formatMarkdownToHtml(text) {
  const source = escapeHtml(normalizeTextBreaks(text));
  const protectedMath = protectMathSegments(source);
  let html = protectedMath.text;

  // Protect code blocks before paragraph splitting
  const codeParts = [];
  html = html.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const token = `@@CODE_${codeParts.length}@@`;
    codeParts.push({ lang: lang || 'plaintext', code });
    return token;
  });

  const blocks = html.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  const formattedBlocks = blocks.map((block) => {
    // Restore code block tokens first
    if (block.includes('@@CODE_')) {
      return block.replace(/@@CODE_(\d+)@@/g, (_m, idx) => {
        const part = codeParts[Number(idx)];
        if (!part) return '';
        const langClass = part.lang && part.lang !== 'plaintext' ? `language-${part.lang}` : '';
        return `<pre class="code-block"><code class="${langClass}">${part.code}</code></pre>`;
      });
    }

    const listMatch = block.match(/^(?:\* .+(?:\n|$))+$/);
    if (listMatch) {
      const items = block
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('* '))
        .map((line) => `<li>${line.slice(2).trim()}</li>`)
        .join('');
      return `<ul>${items}</ul>`;
    }

    let content = block
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    return `<p>${content}</p>`;
  });

  html = formattedBlocks.join('');
  return restoreMathSegments(html, protectedMath.mathParts);
}

function statusLabel(status) {
  return STATUS_LABELS[status] || 'Недоступно';
}

function normalizeText(value) {
  return (value || '').trim().toLowerCase();
}

async function api(path, options = {}) {
  const res = await fetch(path, options);
  if (!res.ok) {
    let detail = 'Ошибка запроса.';
    try {
      const body = await res.json();
      detail = body.detail || body.error || detail;
    } catch (_e) {
      // ignore
    }
    const error = new Error(detail);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

function redirectToStudent(generationId) {
  const target = generationId ? `/material/${encodeURIComponent(generationId)}/` : '/material/';
  window.location.replace(new URL(target, window.location.origin).toString());
}

function getStudentLink(link) {
  try {
    return new URL(link, window.location.origin).toString();
  } catch (_e) {
    return link || '';
  }
}

async function copyStudentLink(link) {
  const target = getStudentLink(link);
  if (!target) return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(target);
    } else {
      const helper = document.createElement('textarea');
      helper.value = target;
      helper.setAttribute('readonly', 'readonly');
      helper.style.position = 'fixed';
      helper.style.left = '-9999px';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      helper.remove();
    }
    return true;
  } catch (_e) {
    return false;
  }
}

const copyButtonRestoreTimers = new WeakMap();

function showCopyButtonState(button) {
  if (!button) return;
  const previousTimer = copyButtonRestoreTimers.get(button);
  if (previousTimer) window.clearTimeout(previousTimer);

  button.dataset.defaultLabel = button.dataset.defaultLabel || button.textContent || 'Скопировать';
  button.textContent = '✓ Скопировано';
  button.classList.add('copied');

  const timer = window.setTimeout(() => {
    button.textContent = button.dataset.defaultLabel || 'Скопировать';
    button.classList.remove('copied');
    copyButtonRestoreTimers.delete(button);
  }, 3000);

  copyButtonRestoreTimers.set(button, timer);
}

async function handleCopyStudentLink(button, link) {
  const copied = await copyStudentLink(link);
  if (copied) showCopyButtonState(button);
}

function openStudentLink(link) {
  const target = getStudentLink(link);
  if (!target) return;
  window.open(target, '_blank', 'noopener,noreferrer');
}

function getActiveGeneration() {
  return generations.find((g) => g.id === activeGenerationId) || null;
}

function getActiveTab() {
  const activeBtn = Array.from(tabBtns).find((btn) => btn.classList.contains('active'));
  return activeBtn ? (activeBtn.getAttribute('data-tab') || 'transcript') : 'transcript';
}

function setActiveTab(tab, gen = getActiveGeneration(), render = true) {
  tabBtns.forEach((btn) => btn.classList.toggle('active', btn.getAttribute('data-tab') === tab));
  Object.values(panels).forEach((panel) => panel.classList.remove('active-pane'));
  if (panels[tab]) panels[tab].classList.add('active-pane');

  if (!render) return;
  if (tab === 'transcript') renderTranscript(gen);
  if (tab === 'summary') renderSummary(gen);
  if (tab === 'quiz') renderQuiz(gen);
  if (tab === 'analytics') renderAnalytics(gen);
}

function enrichGeneration(gen) {
  const prevUi = generationUiState[gen.id];
  const nextUi = prevUi || gen.ui || {
    isEditMode: false,
    isQuizEditMode: false,
    quizIndex: 0,
    quizAnswers: [],
    quizCheckStatus: 'idle',
    quizCheckResult: null
  };
  if (!nextUi.quizCheckStatus) nextUi.quizCheckStatus = 'idle';
  if (!('quizCheckResult' in nextUi)) nextUi.quizCheckResult = null;
  generationUiState[gen.id] = nextUi;
  return {
    ...gen,
    ui: nextUi
  };
}

function setTabLoader(tabBtn, show) {
  const loader = tabBtn && tabBtn.querySelector('.tab-loader');
  if (loader) loader.style.display = show ? 'inline-block' : 'none';
}

function setTabState(tabBtn, enabled, loading) {
  if (!tabBtn) return;
  tabBtn.disabled = !enabled;
  tabBtn.style.opacity = enabled ? '1' : '0.5';
  setTabLoader(tabBtn, loading);
}

function updateTabStates(gen) {
  if (!gen) {
    setTabState(summaryTabBtn, false, false);
    setTabState(quizTabBtn, false, false);
    setTabState(analyticsTabBtn, false, false);
    if (getActiveTab() !== 'transcript') setActiveTab('transcript', null, false);
    return;
  }

  const hasTranscript = Array.isArray(gen.transcript) && gen.transcript.length > 0;
  const hasSummary = Array.isArray(gen.summary) && gen.summary.length > 0;
  const hasQuiz = Array.isArray(gen.quiz) && gen.quiz.length > 0;
  const processing = gen.status === 'processing';

  setTabState(summaryTabBtn, hasSummary || gen.status === 'failed', processing && hasTranscript && !hasSummary);
  setTabState(quizTabBtn, hasQuiz || gen.status === 'failed', processing && hasSummary && !hasQuiz);
  setTabState(analyticsTabBtn, hasQuiz || gen.status === 'failed', processing && hasSummary && !hasQuiz);

  const activeTab = getActiveTab();
  const activeTabBtn = tabBtns && Array.from(tabBtns).find((btn) => btn.getAttribute('data-tab') === activeTab);
  if (activeTab !== 'transcript' && activeTabBtn && activeTabBtn.disabled) {
    setActiveTab('transcript', gen, false);
  }
}

function renderHistory() {
  const hasHistory = generations.length > 0;
  if (historySidebar) historySidebar.hidden = !hasHistory;
  if (historyToggleBtn) historyToggleBtn.hidden = !hasHistory;
  if (pageLayout) pageLayout.classList.toggle('has-history', hasHistory);

  if (!hasHistory) {
    historyList.innerHTML = '';
    historyListMobile.innerHTML = '';
    return;
  }

  const html = generations
    .map((g) => {
      const activeClass = g.id === activeGenerationId ? 'active' : '';
      return `<article class="history-item ${activeClass}">
        <div class="history-item-title">${escapeHtml(g.file_name || 'Генерация')}</div>
        <div class="history-item-row"><span class="history-status status-${g.status}">${escapeHtml(statusLabel(g.status))}</span></div>
        <div class="history-meta">${formatDateTime(g.created_at)}</div>
        <div class="history-actions">
          <button class="history-btn" data-action="open" data-id="${g.id}">Открыть</button>
          <button class="history-btn danger" data-action="delete" data-id="${g.id}">Удалить</button>
        </div>
      </article>`;
    })
    .join('');

  historyList.innerHTML = html;
  historyListMobile.innerHTML = html;
}

function openHistoryDrawer() {
  if (!historyDrawer || !historyOverlay) return;
  historyOverlay.hidden = false;
  historyDrawer.hidden = false;
  historyDrawer.classList.add('open');
  document.body.classList.add('drawer-open');
}

function closeHistoryDrawer() {
  if (!historyDrawer || !historyOverlay) return;
  historyDrawer.classList.remove('open');
  historyOverlay.hidden = true;
  historyDrawer.hidden = true;
  document.body.classList.remove('drawer-open');
}

function mergeGenerationIntoState(updatedGen) {
  if (!updatedGen || !updatedGen.id) return null;
  const enriched = enrichGeneration(updatedGen);
  const existingIndex = generations.findIndex((item) => item.id === enriched.id);
  if (existingIndex >= 0) generations[existingIndex] = enriched;
  else generations = [enriched, ...generations];
  if (requestedGenerationCache && requestedGenerationCache.id === enriched.id) {
    requestedGenerationCache = enriched;
  }
  return enriched;
}

async function refreshGenerationById(generationId) {
  if (!generationId) return null;
  const updated = await api(`/api/generations/${encodeURIComponent(generationId)}`);
  const gen = mergeGenerationIntoState(updated);
  if (!gen) return null;
  renderHistory();
  if (gen.id === activeGenerationId) {
    renderActiveGeneration();
  }
  return gen;
}

function renderTranscript(gen) {
  if (!gen) {
    transcriptContainer.innerHTML = '<div class="status-message">Загрузите файл и нажмите «Обработать запись»</div>';
    updateTranscriptJumpButton();
    return;
  }
  const transcriptLines = normalizeTranscriptLines(gen.transcript);
  const transcriptHtml = transcriptLines.length
    ? transcriptLines
      .map((line) => `<div class="transcript-line"><div class="timestamp">${formatTime(line.start_ms)}</div><div class="line-text">${escapeHtml(line.text || '')}</div></div>`)
      .join('')
    : '';
  const progress = Math.max(0, Math.min(100, Math.round(Number(gen.progress_percent || 0))));
  const isProcessing = gen.status === 'processing';
  const loaderText = isProcessing
    ? (progress < 100 ? `Обрабатываем запись ${progress}%` : (!gen.summary.length ? 'Генерируем конспект...' : (!gen.quiz.length ? 'Генерируем тест...' : 'Завершаем обработку...')))
    : '';

  if (transcriptHtml) {
    transcriptContainer.innerHTML = `
      <div class="transcript-list">${transcriptHtml}</div>
      ${isProcessing ? `<div class="status-message" style="margin-top: 16px;"><span class="spinner-small"></span> ${escapeHtml(loaderText)}</div>` : ''}
    `;
    requestAnimationFrame(updateTranscriptJumpButton);
    return;
  }
  if (isProcessing) {
    transcriptContainer.innerHTML = `<div class="status-message"><span class="spinner-small"></span> ${escapeHtml(loaderText || 'Обрабатываем запись...')}</div>`;
    updateTranscriptJumpButton();
    return;
  }
  if (gen.status === 'failed') {
    transcriptContainer.innerHTML = `<div class="status-message">${escapeHtml(gen.error_message || 'Не удалось получить транскрипт.')}</div>`;
    updateTranscriptJumpButton();
    return;
  }
  transcriptContainer.innerHTML = '<div class="status-message">Транскрипт отсутствует</div>';
  updateTranscriptJumpButton();
}

function updateTranscriptJumpButton() {
  if (!transcriptContainer || !transcriptJumpBtn) return;
  const hasOverflow = transcriptContainer.scrollHeight > transcriptContainer.clientHeight + 2;
  const distanceFromBottom = transcriptContainer.scrollHeight - transcriptContainer.scrollTop - transcriptContainer.clientHeight;
  transcriptJumpBtn.hidden = !(hasOverflow && distanceFromBottom > 20);
}

function scrollTranscriptToBottom() {
  if (!transcriptContainer) return;
  transcriptContainer.scrollTo({ top: transcriptContainer.scrollHeight, behavior: 'smooth' });
}

function nodesToMarkdown(nodes) {
  let result = '';
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || '';
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = node.tagName.toLowerCase();
    const children = Array.from(node.childNodes);

    if (tag === 'br') result += '\n';
    else if (tag === 'strong' || tag === 'b') result += `**${nodesToMarkdown(children).trim()}**`;
    else if (tag === 'em' || tag === 'i') result += `*${nodesToMarkdown(children).trim()}*`;
    else if (tag === 'li') result += `* ${nodesToMarkdown(children).trim()}\n`;
    else if (tag === 'ul' || tag === 'ol') result += `${nodesToMarkdown(children)}\n`;
    else if (tag === 'p' || tag === 'div') {
      const inner = nodesToMarkdown(children).trim();
      if (inner) result += `${inner}\n\n`;
    } else if (tag === 'h2') {
      const inner = nodesToMarkdown(children).trim();
      result += `## ${inner}\n\n`;
    } else result += nodesToMarkdown(children);
  }
  return result;
}

function editorHtmlToSummaryData(editor) {
  const lines = nodesToMarkdown(Array.from(editor.childNodes)).split('\n');
  const sections = [];
  let title = '';
  let body = [];

  const push = () => {
    if (!title && !body.length) return;
    sections.push({ subtopic: title || `Раздел ${sections.length + 1}`, content: body.join('\n').trim() });
  };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      push();
      title = line.slice(3).trim();
      body = [];
    } else {
      body.push(line);
    }
  }
  push();

  return sections.filter((s) => s.subtopic.trim() || s.content.trim());
}

function percentClass(value) {
  if (value >= 70) return 'good';
  if (value >= 40) return 'medium';
  return 'low';
}

function formatRecommendationAction(action) {
  const text = String(action || '').trim();
  if (!text) return '';

  const prefixes = ['Важно разобрать тему', 'Стоит повторить тему'];
  for (const prefix of prefixes) {
    if (text === prefix || text.startsWith(`${prefix}:`)) {
      return `<strong>${escapeHtml(prefix)}</strong>`;
    }
  }

  return escapeHtml(text);
}

function buildQuizCheckPayload(gen) {
  return {
    answers: gen.quiz.map((q, idx) => {
      const qid = String(q.question_id || idx + 1);
      const qtype = q.question_type === 'open_ended' || q.question_type === 'open_question' ? 'open_question' : 'multiple_choice';
      const subtopic = q.subtopic || `Подтема ${idx + 1}`;
      const answer = gen.ui.quizAnswers[idx] || {};

      if (qtype === 'multiple_choice') {
        return {
          question_id: qid,
          question_type: 'multiple_choice',
          subtopic,
          is_correct: answer.answer === q.correct_answer
        };
      }

      return {
        question_id: qid,
        question_type: 'open_question',
        subtopic,
        question_text: q.question_text || '',
        correct_answer: q.correct_answer || '',
        student_answer: typeof answer.answer === 'string' ? answer.answer : ''
      };
    })
  };
}

function buildQuizMastery(results) {
  const stats = new Map();
  (results || []).forEach((item) => {
    const subtopic = item.subtopic || 'Без темы';
    const current = stats.get(subtopic) || { correct: 0, total: 0 };
    current.correct += item.score ? 1 : 0;
    current.total += 1;
    stats.set(subtopic, current);
  });
  return Array.from(stats.entries()).map(([subtopic, stat]) => ({
    subtopic,
    percent: stat.total ? Math.round((stat.correct / stat.total) * 100) : 0
  }));
}

function getQuizSubtopics(quiz) {
  const subtopics = new Set();
  quiz.forEach(q => {
    if (q.subtopic) subtopics.add(q.subtopic);
  });
  return Array.from(subtopics);
}

function findSummaryIndex(gen, subtopic) {
  const target = (subtopic || '').trim().toLowerCase();
  if (!gen || !target) return -1;
  return (gen.summary || []).findIndex((section) => (section.subtopic || '').trim().toLowerCase() === target);
}

function truncateLabel(text, maxLength = 30) {
  const value = text || '';
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

function reviseButtonHtml(gen, subtopic) {
  if (!subtopic || findSummaryIndex(gen, subtopic) < 0) return '';
  return `
    <div class="next-btn-container">
      <button id="reviseSubtopicBtn" class="next-question-btn text-truncate" title="${escapeHtml(subtopic)}">Повторить тему «${escapeHtml(truncateLabel(subtopic))}»</button>
    </div>
  `;
}

function renderQuizAnalysisLoader() {
  quizContainer.innerHTML = `
    <div class="quiz-final-loader">
      <div class="quiz-spinner"></div>
      <div class="quiz-final-loader-title">Анализируем результаты...</div>
      <div class="quiz-final-loader-subtitle">Проверяем открытые ответы и собираем статистику по темам</div>
    </div>
  `;
}

function getTeacherQuizItemRoot(gen) {
  if (!gen) return null;
  return quizContainer.querySelector(`.quiz-item[data-question-idx="${gen.ui.quizIndex}"]`);
}

function applyTeacherSelectedAnswer(gen, answerIdx) {
  const root = getTeacherQuizItemRoot(gen);
  const q = gen && Array.isArray(gen.quiz) ? gen.quiz[gen.ui.quizIndex] : null;
  if (!root || !q) return;

  const options = Array.from(root.querySelectorAll('.quiz-option'));
  const correctIndex = Number(q.correct_answer);
  const isCorrect = answerIdx === correctIndex;

  root.classList.add('is-answered');
  options.forEach((node, idx) => {
    node.classList.remove('correct-highlight', 'wrong-highlight', 'is-selected');
    if (idx === correctIndex) node.classList.add('correct-highlight');
    if (idx === answerIdx && !isCorrect) node.classList.add('wrong-highlight');
    if (idx === answerIdx) node.classList.add('is-selected');
  });

  if (!isCorrect) {
    const feedback = root.querySelector('[data-quiz-feedback]');
    if (feedback) feedback.hidden = false;
    const nextBtn = root.querySelector('.next-question-btn');
    if (nextBtn) nextBtn.hidden = false;
  } else {
    setTimeout(() => nextQuestion(), 450);
  }
}

function renderQuizCheckResults(data) {
  const gen = getActiveGeneration();
  const mastery = buildQuizMastery(Array.isArray(data.results) ? data.results : []);
  const allSubtopics = getQuizSubtopics(gen.quiz);
  const filteredMastery = mastery.filter(item => allSubtopics.includes(item.subtopic));
  const rowsHtml = filteredMastery
    .map((item) => {
      const levelClass = percentClass(item.percent);
      return `
        <div class="quiz-result-row">
          <div class="quiz-result-subtopic">${escapeHtml(item.subtopic)}</div>
          <div class="quiz-result-progress-line">
            <div class="quiz-result-progress-fill ${levelClass}" style="width:${item.percent}%"></div>
          </div>
          <div class="quiz-result-percent">${item.percent}%</div>
        </div>
      `;
    })
    .join('');

  quizContainer.innerHTML = `
    <div class="quiz-results-card">
      <h3>Результаты теста</h3>
      <div class="quiz-results-grid">${rowsHtml || '<div class="status-message">Нет данных для анализа.</div>'}</div>
    </div>
  `;
  setTimeout(() => renderMathInContainer(quizContainer), 30);
}

function renderQuizCheckError(message) {
  quizContainer.innerHTML = `
    <div class="quiz-results-card">
      <h3>Не удалось проверить тест</h3>
      <div class="quiz-result-recommendation">${escapeHtml(message || 'Попробуйте отправить ответы на проверку еще раз.')}</div>
      <div class="next-btn-container error-action-row"><button class="next-question-btn" onclick="retryTeacherQuizCheck()">Попробовать еще раз</button></div>
    </div>
  `;
}

async function checkTeacherQuizResults(gen, force = false) {
  if (!gen || gen.ui.quizCheckStatus === 'checking') return;
  if (!force && gen.ui.quizCheckStatus === 'done' && gen.ui.quizCheckResult) {
    renderQuiz(gen);
    return;
  }
  gen.ui.quizCheckStatus = 'checking';
  gen.ui.quizCheckResult = null;
  renderQuizAnalysisLoader();

  try {
    const data = await api(`/api/student/${gen.id}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildQuizCheckPayload(gen))
    });
    gen.ui.quizCheckStatus = 'done';
    gen.ui.quizCheckResult = data;
    renderQuiz(gen);
  } catch (e) {
    gen.ui.quizCheckStatus = 'failed';
    gen.ui.quizCheckResult = { results: [], recommendation: e.message || 'Не удалось проверить тест.' };
    renderQuizCheckError(gen.ui.quizCheckResult.recommendation);
  }
}

function renderSummary(gen) {
  if (!gen) {
    summaryContainer.innerHTML = '<div class="status-message">Конспект появится после обработки</div>';
    return;
  }
  if (gen.status === 'failed' && !gen.summary.length) {
    summaryContainer.innerHTML = `
      <div class="status-message status-message-error">
        ${escapeHtml(gen.error_message || 'Не удалось сгенерировать конспект.')}
        <div class="next-btn-container"><button class="next-question-btn" onclick="retryGeneration()">Попробовать снова</button></div>
      </div>
    `;
    return;
  }
  if (!gen.summary.length) {
    summaryContainer.innerHTML = `<div class="status-message">${gen.status === 'processing' ? 'Генерируем конспект...' : 'Конспект отсутствует'}</div>`;
    return;
  }

  const ui = gen.ui;
  if (ui.isEditMode) {
    const content = gen.summary
      .map((section) => `<h2>${escapeHtml(section.subtopic || '')}</h2>${formatMarkdownToHtml(section.content || '')}`)
      .join('');
    summaryContainer.innerHTML = `
      <div class="markdown-editor-container">
        <div class="markdown-editor-toolbar">
          <button class="toolbar-btn" onclick="applyRichCommand('h2')">Заголовок H2</button>
          <button class="toolbar-btn" onclick="applyRichCommand('bold')">Жирный</button>
          <button class="toolbar-btn" onclick="applyRichCommand('italic')">Курсив</button>
          <button class="toolbar-btn" onclick="applyRichCommand('unorderedList')">Список</button>
          <button class="toolbar-btn" onclick="insertFormulaBlock()">Формула</button>
        </div>
        <div id="richSummaryEditor" class="markdown-editor rich-editor" contenteditable="true">${content}</div>
      </div>
    `;
    return;
  }

  let tocHtml = '<div class="summary-toc"><h4>📑 Оглавление</h4><ul class="toc-list">';
  let contentHtml = '<div class="summary-content">';
  for (let idx = 0; idx < gen.summary.length; idx++) {
    const section = gen.summary[idx];
    const id = `section-${idx}`;
    tocHtml += `<li class="toc-item" data-subtopic="${escapeHtml(section.subtopic || '')}" data-section-id="${id}">${escapeHtml(section.subtopic || '')}</li>`;
    contentHtml += `<div id="${id}" class="summary-section" data-subtopic="${escapeHtml(section.subtopic || '')}"><h3>${escapeHtml(section.subtopic || '')}</h3><div class="content">${formatMarkdownToHtml(section.content || '')}</div></div>`;
  }
  tocHtml += '</ul></div>';
  contentHtml += '</div>';
  summaryContainer.innerHTML = `<div class="summary-layout">${tocHtml}${contentHtml}</div>`;
  summaryContainer.querySelectorAll('.toc-item').forEach((item) => {
    item.addEventListener('click', () => {
      activeSummarySubtopic = item.getAttribute('data-subtopic') || '';
      syncSummarySelection();
      const sectionId = item.getAttribute('data-section-id');
      if (sectionId) {
        setTimeout(() => {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 40);
      }
    });
  });
  syncSummarySelection();
  setTimeout(() => {
    renderMathInContainer(summaryContainer);
    highlightCodeInContainer(summaryContainer);
  }, 30);
}

function syncSummarySelection() {
  if (!summaryContainer) return;
  const active = normalizeText(activeSummarySubtopic);
  summaryContainer.querySelectorAll('.toc-item').forEach((item) => {
    const isActive = normalizeText(item.getAttribute('data-subtopic')) === active;
    item.classList.toggle('active', isActive);
  });
  summaryContainer.querySelectorAll('.summary-section').forEach((section) => {
    const isActive = normalizeText(section.getAttribute('data-subtopic')) === active;
    section.classList.toggle('is-active', isActive);
  });
}

function renderQuiz(gen) {
  if (!gen) {
    quizContainer.innerHTML = '<div class="status-message">Тест появится после обработки</div>';
    return;
  }
  if (gen.status === 'failed' && !gen.quiz.length) {
    quizContainer.innerHTML = `
      <div class="status-message status-message-error">
        ${escapeHtml(gen.error_message || 'Не удалось сгенерировать тест.')}
        <div class="next-btn-container error-action-row"><button class="next-question-btn" onclick="retryGeneration()">Попробовать снова</button></div>
      </div>
    `;
    return;
  }
  if (!gen.quiz.length) {
    quizContainer.innerHTML = `<div class="status-message">${gen.status === 'processing' ? 'Генерируем тест...' : 'Тест отсутствует'}</div>`;
    return;
  }

  const ui = gen.ui;

  if (ui.isQuizEditMode) {
    const editorHtml = gen.quiz
      .map((q, idx) => {
        const typeLabel = q.question_type === 'open_ended' ? 'Открытый' : 'С выбором';
        const opts = Array.isArray(q.options) && q.options.length ? q.options : ['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4'];
        const optionsHtml = q.question_type === 'multiple_choice'
          ? opts.map((opt, optIdx) => `
              <div class="quiz-edit-option">
                <span class="quiz-edit-option-label">${optIdx + 1}.</span>
                <input class="quiz-edit-input" data-field="option" data-opt-index="${optIdx}" value="${escapeHtml(normalizeQuizText(opt || ''))}" />
              </div>`).join('') +
            `<div class="quiz-edit-correct-row">Правильный вариант:
               <select class="quiz-edit-select" data-field="correct_answer">
                 ${opts.map((_, optIdx) => `<option value="${optIdx}" ${optIdx === q.correct_answer ? 'selected' : ''}>${optIdx + 1}</option>`).join('')}
               </select>
             </div>`
          : '';

        const openPart = q.question_type === 'open_ended'
          ? `<div class="quiz-edit-answer-row"><div class="quiz-edit-label">Эталонный ответ</div><textarea class="quiz-edit-textarea" data-field="correct_answer" rows="3">${escapeHtml(normalizeQuizText(q.correct_answer || ''))}</textarea></div>`
          : '';

        return `
          <div class="quiz-edit-item" data-question-index="${idx}" data-question-type="${q.question_type}">
            <div class="quiz-edit-top"><div class="quiz-edit-number">Вопрос ${idx + 1}</div><div class="quiz-edit-type">${typeLabel}</div></div>
            <div class="quiz-edit-label">Подтема</div>
            <input class="quiz-edit-input" data-field="subtopic" value="${escapeHtml(normalizeQuizText(q.subtopic || ''))}" />
            <div class="quiz-edit-label">Текст вопроса</div>
            <textarea class="quiz-edit-textarea" data-field="question_text" rows="3">${escapeHtml(normalizeQuizText(q.question_text || ''))}</textarea>
            ${optionsHtml}
            ${openPart}
            <div class="quiz-edit-answer-row"><div class="quiz-edit-label">Объяснение</div><textarea class="quiz-edit-textarea" data-field="explanation" rows="3">${escapeHtml(normalizeQuizText(q.explanation || ''))}</textarea></div>
            <div class="quiz-edit-actions"><button class="quiz-edit-action-btn danger" type="button" onclick="removeQuizQuestion(${idx})">Удалить вопрос</button></div>
          </div>
        `;
      })
      .join('');

    quizContainer.innerHTML = `<div class="quiz-editor">${editorHtml}
      <div class="quiz-edit-global-actions">
        <button class="quiz-edit-action-btn" type="button" onclick="addQuizQuestion('multiple_choice')">+ С выбором</button>
        <button class="quiz-edit-action-btn" type="button" onclick="addQuizQuestion('open_ended')">+ Открытый</button>
      </div>
    </div>`;
    return;
  }

  const quiz = gen.quiz;
  if (ui.quizIndex >= quiz.length) {
    if (ui.quizCheckStatus === 'done' && ui.quizCheckResult) {
      renderQuizCheckResults(ui.quizCheckResult);
      return;
    }
    if (ui.quizCheckStatus === 'failed' && ui.quizCheckResult) {
      renderQuizCheckError(ui.quizCheckResult.recommendation || 'Не удалось проверить тест.');
      return;
    }
    renderQuizAnalysisLoader();
    setTimeout(() => checkTeacherQuizResults(gen), 0);
    return;
  }

  const q = quiz[ui.quizIndex];
  const answered = ui.quizAnswers[ui.quizIndex] && ui.quizAnswers[ui.quizIndex].answered;
  const open = q.question_type === 'open_ended';

  let html = `<div class="quiz-item" data-question-idx="${ui.quizIndex}"><div class="quiz-question">${ui.quizIndex + 1}. ${markdownInlineToHtmlQuiz(q.question_text || '')}</div>`;

  if (open) {
    if (!answered) {
      html += '<div class="open-ended-area"><textarea id="openAnswer" class="open-ended-input" rows="4" placeholder="Введите ваш ответ..."></textarea><button class="check-answer-btn" onclick="checkOpenEndedAnswer()">Проверить ответ</button></div>';
    } else {
      html += `<div class="open-ended-area"><textarea class="open-ended-input" rows="4" disabled>${escapeHtml(ui.quizAnswers[ui.quizIndex].answer || '')}</textarea></div>`;
      html += `<div class="explanation-box"><strong>Эталонный ответ:</strong><br>${markdownInlineToHtmlQuiz(q.correct_answer || '')}</div>`;
      html += '<div class="next-btn-container"><button class="next-question-btn" type="button">Далее</button></div>';
    }
  } else {
    const options = Array.isArray(q.options) ? q.options : [];
    for (let i = 0; i < options.length; i++) {
      html += `<div class="quiz-option" data-opt-index="${i}"><label>${markdownInlineToHtmlQuiz(options[i] || '')}</label></div>`;
    }
    html += `
      <div class="quiz-feedback" data-quiz-feedback hidden>
        <div class="explanation-box"><strong>Объяснение:</strong><br>${markdownInlineToHtmlQuiz(q.explanation || '')}</div>
        <div class="next-btn-container"><button class="next-question-btn" type="button">Далее</button></div>
      </div>
    `;
  }

  html += '</div>';
  quizContainer.innerHTML = html;

  if (!open) {
    quizContainer.querySelectorAll('.quiz-option').forEach((node) => {
      node.addEventListener('click', () => {
        const idx = parseInt(node.getAttribute('data-opt-index'), 10);
        selectAnswer(idx);
      });
    });
  }

  const nextBtn = quizContainer.querySelector('.next-question-btn');
  if (nextBtn) {
    nextBtn.onclick = function() {
      if (gen.ui.quizIndex >= gen.quiz.length) return;
      nextQuestion();
    };
  }

  if (!open && answered) {
    applyTeacherSelectedAnswer(gen, ui.quizAnswers[ui.quizIndex].answer);
  }

  setTimeout(() => renderMathInContainer(quizContainer), 30);
}

function renderAnalytics(gen) {
  if (!gen) {
    analyticsContainer.innerHTML = '<div class="status-message">Аналитика появится после обработки</div>';
    return;
  }
  if (gen.status === 'failed') {
    analyticsContainer.innerHTML = '<div class="status-message">Аналитика недоступна из-за ошибки генерации.</div>';
    return;
  }
  if (!gen.analytics || !gen.analytics.studentLink) {
    analyticsContainer.innerHTML = '<div class="status-message">Аналитика появится после обработки</div>';
    return;
  }

  const link = `${location.origin}/material/${encodeURIComponent(gen.id)}/`;
  const displayLink = link;
  const completed = Number(gen.analytics.studentsCompleted || 0);
  const mastery = completed && Array.isArray(gen.analytics.mastery) ? gen.analytics.mastery : [];
  const recommendations = completed && Array.isArray(gen.analytics.recommendations) ? gen.analytics.recommendations.slice(0, 2) : [];
  const masteryHtml = mastery
    .map((item) => {
      const percent = Math.max(0, Math.min(100, Number(item.percent || 0)));
      const levelClass = percentClass(percent);
      const totalLabel = item.total ? ` · ${item.correct || 0}/${item.total}` : '';
      return `
        <div class="analytics-row">
          <div class="analytics-subtopic">${escapeHtml(item.subtopic || 'Без темы')}${escapeHtml(totalLabel)}</div>
          <div class="analytics-progress-line">
            <div class="analytics-progress-fill ${levelClass}" style="width:${percent}%"></div>
          </div>
          <div class="analytics-percent">${percent}%</div>
        </div>
      `;
    })
    .join('');
  const recommendationsHtml = recommendations.length
    ? recommendations.map((item) => {
        const accent = item.priority === 'high' ? 'high' : 'medium';
        const topic = escapeHtml(item.subtopic || 'Без темы');
        const actionHtml = formatRecommendationAction(item.action || '');
        return `
          <div class="analytics-reco ${accent}">
            <div class="analytics-reco-action">${actionHtml}</div>
            <div class="analytics-reco-topic">${topic}</div>
          </div>
        `;
      }).join('')
    : '<div class="analytics-reco muted">Слабых подтем пока не найдено.</div>';

  analyticsContainer.innerHTML = `
    <div class="analytics-stack">
      <section class="analytics-card">
        <div class="analytics-title">Ссылка для учеников</div>
        <div class="analytics-link-wrap">
          <div class="analytics-link">${escapeHtml(displayLink)}</div>
        </div>
        <div class="analytics-link-actions">
          <button class="analytics-btn outline" type="button" onclick="openStudentLink('${escapeHtml(link)}')">Перейти</button>
          <button class="analytics-btn filled" type="button" onclick="handleCopyStudentLink(this, '${escapeHtml(link)}')">Скопировать</button>
        </div>
        <div class="analytics-meta">Завершено попыток: ${completed}</div>
      </section>

      <section class="analytics-card ${completed ? '' : 'analytics-card-disabled'}">
        <div class="analytics-title">Освоение подтем</div>
        ${masteryHtml || '<div class="status-message">Результаты появятся после первой проверки теста учеником.</div>'}
      </section>

      <section class="analytics-card ${completed ? '' : 'analytics-card-disabled'}">
        <div class="analytics-title">Рекомендации</div>
        <div class="analytics-reco-list">${completed ? recommendationsHtml : '<div class="analytics-reco muted">Пока нет данных для рекомендаций.</div>'}</div>
      </section>
    </div>
  `;
  setTimeout(() => renderMathInContainer(analyticsContainer), 30);
}

function renderActiveGeneration() {
  const gen = getActiveGeneration();
  if (gen && meUserId && gen.creator_id && gen.creator_id !== meUserId) {
    redirectToStudent(gen.id);
    return;
  }
  if (!window.matchMedia('(max-width: 1079px)').matches) {
    closeHistoryDrawer();
  }
  updateTabStates(gen);

  const canEdit = !!gen && (!gen.creator_id || gen.creator_id === meUserId);
  editSummaryBtn.disabled = !canEdit || gen.status !== 'completed' || !gen.summary.length;
  editQuizBtn.disabled = !canEdit || gen.status !== 'completed' || !gen.quiz.length;
  editSummaryBtn.textContent = gen && gen.ui.isEditMode ? 'Сохранить' : '✏️ Редактировать конспект';
  editQuizBtn.textContent = gen && gen.ui.isQuizEditMode ? 'Сохранить' : '✏️ Редактировать тест';

  renderTranscript(gen);
  renderSummary(gen);
  renderQuiz(gen);
  renderAnalytics(gen);
}

async function refresh() {
  const data = await api('/api/generations');
  generations = (data.items || []).map(enrichGeneration);
  if (requestedGenerationCache && requestedGenerationCache.creator_id === meUserId) {
    const exists = generations.some((g) => g.id === requestedGenerationCache.id);
    if (!exists) {
      generations = [enrichGeneration(requestedGenerationCache), ...generations];
    }
  }
  const aliveIds = new Set(generations.map((g) => g.id));
  Object.keys(generationUiState).forEach((id) => {
    if (!aliveIds.has(id)) delete generationUiState[id];
  });
  if (requestedGenerationId && aliveIds.has(requestedGenerationId)) {
    activeGenerationId = requestedGenerationId;
  } else if (!activeGenerationId && generations.length && !neutralMode) {
    activeGenerationId = generations[0].id;
  }
  renderHistory();
  renderActiveGeneration();
}

function scheduleWsReconnect() {
  if (wsReconnectTimer) return;
  const delay = Math.min(1000 * (2 ** wsReconnectAttempt), 15000);
  wsReconnectAttempt += 1;
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null;
    connectWs();
  }, delay);
}

function connectWs() {
  if (!meUserId) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}/ws/generations?user_id=${encodeURIComponent(meUserId)}`);
  ws.onopen = () => {
    const wasReconnect = wsReconnectAttempt > 0;
    wsReconnectAttempt = 0;
    ws.send('ping');
    if (wasReconnect) {
      refresh().catch(() => {});
    }
  };
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data || '{}');
      if (msg.type === 'generation_analytics_updated') {
        if (msg.generation_id) {
          refreshGenerationById(msg.generation_id).catch(() => {
            refresh().catch(() => {});
          });
        } else {
          refresh().catch(() => {});
        }
        return;
      }
      if (msg.type === 'generation_updated') refresh().catch(() => {});
    } catch (_e) {
      // ignore
    }
  };
  ws.onerror = () => {
    try {
      ws.close();
    } catch (_e) {
      // ignore
    }
  };
  ws.onclose = () => {
    ws = null;
    scheduleWsReconnect();
  };
}

function showSelectedFile(file) {
  uploadStatusDiv.innerHTML = `<div class="file-info">Файл \"${escapeHtml(file.name)}\" загружен</div>`;
  generateBtn.disabled = false;
}

async function createGenerationFromFile() {
  if (!selectedFile) return;
  const fd = new FormData();
  fd.append('file', selectedFile);
  generateBtn.disabled = true;
  uploadStatusDiv.innerHTML = '<div class="file-info">Отправляем файл в обработку...</div>';
  setTabState(summaryTabBtn, false, false);
  setTabState(quizTabBtn, false, false);
  setTabState(analyticsTabBtn, false, false);

  try {
    const created = await api('/api/generations/upload', { method: 'POST', body: fd });
    neutralMode = false;
    activeGenerationId = created.id;
    selectedFile = null;
    fileInput.value = '';
    uploadStatusDiv.innerHTML = '';
    await refresh();
  } catch (e) {
    uploadStatusDiv.innerHTML = `<div class="file-info">${escapeHtml(e.message || 'Не удалось запустить обработку файла.')}</div>`;
    generateBtn.disabled = false;
  }
}

async function saveSummaryEdit() {
  const gen = getActiveGeneration();
  if (!gen) return;
  const editor = document.getElementById('richSummaryEditor');
  if (!editor) return;
  const summary = editorHtmlToSummaryData(editor);
  if (!summary.length) {
    showPopover('Добавьте хотя бы один раздел в конспекте.');
    return;
  }
  await api(`/api/generations/${gen.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary })
  });
  gen.summary = summary;
  gen.ui.isEditMode = false;
  renderSummary(gen);
}

async function saveQuizEdit() {
  const gen = getActiveGeneration();
  if (!gen) return;

  const items = Array.from(quizContainer.querySelectorAll('.quiz-edit-item'));
  if (!items.length) return;

  const quiz = items.map((item, index) => {
    const type = item.getAttribute('data-question-type');
    const question_text = (item.querySelector('[data-field="question_text"]')?.value || '').trim();
    const explanation = (item.querySelector('[data-field="explanation"]')?.value || '').trim();
    const subtopic = (item.querySelector('[data-field="subtopic"]')?.value || '').trim();

    if (type === 'multiple_choice') {
      const options = Array.from(item.querySelectorAll('[data-field="option"]')).map((n) => (n.value || '').trim());
      const correctRaw = parseInt(item.querySelector('[data-field="correct_answer"]')?.value || '0', 10);
      const correct_answer = Number.isNaN(correctRaw) ? 0 : Math.max(0, Math.min(correctRaw, Math.max(options.length - 1, 0)));
      return {
        question_id: index + 1,
        question_text,
        question_type: 'multiple_choice',
        options,
        correct_answer,
        explanation,
        subtopic
      };
    }

    return {
      question_id: index + 1,
      question_text,
      question_type: 'open_ended',
      options: null,
      correct_answer: (item.querySelector('[data-field="correct_answer"]')?.value || '').trim(),
      explanation,
      subtopic
    };
  });

  await api(`/api/generations/${gen.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quiz })
  });

  gen.quiz = quiz;
  gen.ui.isQuizEditMode = false;
  gen.ui.quizIndex = 0;
  gen.ui.quizAnswers = [];
  gen.ui.quizCheckStatus = 'idle';
  gen.ui.quizCheckResult = null;
  renderQuiz(gen);
}

window.retryGeneration = async function retryGeneration() {
  const gen = getActiveGeneration();
  if (!gen || gen.status === 'processing') return;
  try {
    await api(`/api/generations/${gen.id}/retry`, { method: 'POST' });
    gen.status = 'processing';
    gen.error_message = '';
    renderActiveGeneration();
    setTimeout(() => refresh().catch(() => {}), 700);
  } catch (e) {
    showPopover(e.message || 'Не удалось запустить повторную генерацию.');
  }
};

window.retryTeacherQuizCheck = function retryTeacherQuizCheck() {
  const gen = getActiveGeneration();
  if (!gen) return;
  checkTeacherQuizResults(gen, true);
};

window.openSummarySubtopic = function openSummarySubtopic(subtopic) {
  const gen = getActiveGeneration();
  activeSummarySubtopic = subtopic || '';
  const idx = findSummaryIndex(gen, subtopic);
  if (summaryTabBtn) {
    summaryTabBtn.disabled = false;
    summaryTabBtn.style.opacity = '1';
  }
  const shouldRender = getActiveTab() !== 'summary';
  setActiveTab('summary', gen, shouldRender);
  if (!shouldRender) syncSummarySelection();
  if (idx >= 0) {
    setTimeout(() => {
      document.getElementById(`section-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  }
};

function bindEvents() {
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    selectedFile = f;
    showSelectedFile(f);
  });

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    selectedFile = f;
    showSelectedFile(f);
  });

  generateBtn.addEventListener('click', createGenerationFromFile);

  resetUploadBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    selectedFile = null;
    fileInput.value = '';
    uploadStatusDiv.innerHTML = '';
    generateBtn.disabled = true;
    neutralMode = true;
    activeGenerationId = null;
    renderHistory();
    renderActiveGeneration();
  });

  editSummaryBtn.addEventListener('click', async () => {
    const gen = getActiveGeneration();
    if (!gen || gen.status !== 'completed' || !gen.summary.length) return;
    if (gen.ui.isEditMode) {
      await saveSummaryEdit();
    } else {
      gen.ui.isEditMode = true;
      renderSummary(gen);
    }
    editSummaryBtn.textContent = gen.ui.isEditMode ? 'Сохранить' : '✏️ Редактировать конспект';
  });

  editQuizBtn.addEventListener('click', async () => {
    const gen = getActiveGeneration();
    if (!gen || gen.status !== 'completed' || !gen.quiz.length) return;
    if (gen.ui.isQuizEditMode) {
      await saveQuizEdit();
    } else {
      gen.ui.isQuizEditMode = true;
      renderQuiz(gen);
    }
    editQuizBtn.textContent = gen.ui.isQuizEditMode ? 'Сохранить' : '✏️ Редактировать тест';
  });

  const onHistoryClick = async (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    if (!id) return;

    if (action === 'delete') {
      await api(`/api/generations/${id}`, { method: 'DELETE' });
      if (activeGenerationId === id) activeGenerationId = null;
      await refresh();
      closeHistoryDrawer();
      return;
    }

    neutralMode = false;
    activeGenerationId = id;
    await refresh();
    closeHistoryDrawer();
  };

  historyList.addEventListener('click', onHistoryClick);
  historyListMobile.addEventListener('click', onHistoryClick);

  if (historyToggleBtn) {
    historyToggleBtn.addEventListener('click', () => {
      openHistoryDrawer();
    });
  }
  if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener('click', closeHistoryDrawer);
  }
  if (historyOverlay) {
    historyOverlay.addEventListener('click', closeHistoryDrawer);
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      if (btn.disabled) return;
      setActiveTab(tab);
    });
  });

  if (transcriptContainer) {
    transcriptContainer.addEventListener('scroll', () => {
      if (transcriptJumpRaf) return;
      transcriptJumpRaf = window.requestAnimationFrame(() => {
        transcriptJumpRaf = 0;
        updateTranscriptJumpButton();
      });
    });
  }

  if (transcriptJumpBtn) {
    transcriptJumpBtn.addEventListener('click', scrollTranscriptToBottom);
  }
}

window.applyRichCommand = function applyRichCommand(command) {
  const editor = document.getElementById('richSummaryEditor');
  if (!editor) return;
  editor.focus();
  if (command === 'h2') {
    document.execCommand('formatBlock', false, 'h2');
    return;
  }
  if (command === 'unorderedList') {
    document.execCommand('insertUnorderedList', false, null);
    return;
  }
  document.execCommand(command, false, null);
};

window.insertFormulaBlock = function insertFormulaBlock() {
  const editor = document.getElementById('richSummaryEditor');
  if (!editor) return;
  editor.focus();
  document.execCommand('insertText', false, '\n$$\n\n$$\n');
};

window.selectAnswer = function selectAnswer(answerIdx) {
  const gen = getActiveGeneration();
  if (!gen) return;
  const ui = gen.ui;
  const q = gen.quiz[ui.quizIndex];
  if (!q) return;
  if (ui.quizAnswers[ui.quizIndex] && ui.quizAnswers[ui.quizIndex].answered) return;
  ui.quizAnswers[ui.quizIndex] = { answer: answerIdx, answered: true };
  applyTeacherSelectedAnswer(gen, answerIdx);
};

window.checkOpenEndedAnswer = function checkOpenEndedAnswer() {
  const gen = getActiveGeneration();
  if (!gen) return;
  const input = document.getElementById('openAnswer');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  gen.ui.quizAnswers[gen.ui.quizIndex] = { answer: val, answered: true };
  renderQuiz(gen);
};

window.nextQuestion = function nextQuestion() {
  const gen = getActiveGeneration();
  if (!gen) return;
  if (gen.ui.quizIndex + 1 < gen.quiz.length) gen.ui.quizIndex += 1;
  else gen.ui.quizIndex = gen.quiz.length;
  renderQuiz(gen);
};

window.addQuizQuestion = function addQuizQuestion(type) {
  const gen = getActiveGeneration();
  if (!gen) return;
  const q = type === 'open_ended'
    ? {
        question_id: gen.quiz.length + 1,
        question_text: 'Новый открытый вопрос',
        question_type: 'open_ended',
        options: null,
        correct_answer: '',
        explanation: '',
        subtopic: ''
      }
    : {
        question_id: gen.quiz.length + 1,
        question_text: 'Новый вопрос с выбором',
        question_type: 'multiple_choice',
        options: ['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4'],
        correct_answer: 0,
        explanation: '',
        subtopic: ''
      };
  gen.quiz.push(q);
  renderQuiz(gen);
};

window.removeQuizQuestion = function removeQuizQuestion(index) {
  const gen = getActiveGeneration();
  if (!gen) return;
  if (gen.quiz.length <= 1) {
    showPopover('В тесте должен остаться хотя бы один вопрос.');
    return;
  }
  gen.quiz.splice(index, 1);
  renderQuiz(gen);
};

(async function init() {
  const me = await api('/api/me');
  meUserId = me.user_id || '';
  bindEvents();
  try {
    if (requestedGenerationId) {
      requestedGenerationCache = await api(`/api/generations/${requestedGenerationId}`);
      if (requestedGenerationCache.creator_id && requestedGenerationCache.creator_id !== meUserId) {
        redirectToStudent(requestedGenerationId);
        return;
      }
      activeGenerationId = requestedGenerationId;
    }
    await refresh();
    connectWs();
  } catch (e) {
    if (requestedGenerationId && e && e.status === 404) {
      redirectToStudent(requestedGenerationId);
      return;
    }
    throw e;
  }
})();

window.addEventListener('resize', () => updateTranscriptJumpButton());
