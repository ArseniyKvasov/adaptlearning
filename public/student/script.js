const summaryContainer = document.getElementById('summaryContainer');
const quizContainer = document.getElementById('quizContainer');
const tabBtns = document.querySelectorAll('.tab-btn');
const panels = {
  summary: document.getElementById('panelSummary'),
  quiz: document.getElementById('panelQuiz')
};

let generationId = '';
let quizData = [];
let summaryData = [];
let activeSummarySubtopic = '';
const quizState = {
  index: 0,
  answers: {},
  checkStatus: 'idle',
  checkResult: null,
  reviewMode: false
};

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
    .replace(/\f/g, '\\f')
    .replace(/\r/g, '\\r')
    .replace(/\\n/g, '\n');
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
  const blocks = protectedMath.text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  const formattedBlocks = blocks.map((block) => {
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

    const content = block
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    return `<p>${content}</p>`;
  });

  return restoreMathSegments(formattedBlocks.join(''), protectedMath.mathParts);
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

function getGenerationId() {
  const url = new URL(window.location.href);
  const queryGenerationId = url.searchParams.get('generation_id') || '';
  if (queryGenerationId) return queryGenerationId;

  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts[0] === 'material' && pathParts[1]) {
    return decodeURIComponent(pathParts[1]);
  }

  return '';
}

function percentClass(value) {
  if (value >= 70) return 'good';
  if (value >= 40) return 'medium';
  return 'low';
}

function getQuizSubtopics() {
  const subtopics = new Set();
  quizData.forEach((q) => {
    if (q.subtopic) subtopics.add(q.subtopic);
  });
  return Array.from(subtopics);
}

function findSummaryIndex(subtopic) {
  const target = (subtopic || '').trim().toLowerCase();
  if (!target) return -1;
  return summaryData.findIndex((section) => (section.subtopic || '').trim().toLowerCase() === target);
}

function truncateLabel(text, maxLength = 30) {
  const value = text || '';
  return value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;
}

function switchToSummarySubtopic(subtopic) {
  activeSummarySubtopic = subtopic || '';
  const idx = findSummaryIndex(subtopic);
  const shouldRender = !panels.summary.classList.contains('active-pane');
  tabBtns.forEach((item) => item.classList.toggle('active', item.getAttribute('data-tab') === 'summary'));
  Object.values(panels).forEach((panel) => panel.classList.remove('active-pane'));
  panels.summary.classList.add('active-pane');
  if (shouldRender) {
    renderSummary();
  } else {
    syncSummarySelection();
  }
  if (idx >= 0) {
    setTimeout(() => {
      document.getElementById(`summary-section-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  }
}

function reviseButtonHtml(subtopic) {
  const idx = findSummaryIndex(subtopic);
  if (!subtopic || idx < 0) return '';
  return `
    <div class="next-btn-container">
      <button id="reviseSubtopicBtn" class="next-question-btn text-truncate" title="${escapeHtml(subtopic)}">Повторить тему «${escapeHtml(truncateLabel(subtopic))}»</button>
    </div>
  `;
}

function buildCheckPayload() {
  return {
    answers: quizData.map((q, idx) => {
      const qid = String(q.question_id || idx + 1);
      const qtype = q.question_type === 'open_ended' || q.question_type === 'open_question' ? 'open_question' : 'multiple_choice';
      const subtopic = q.subtopic || `Подтема ${idx + 1}`;
      const answerState = quizState.answers[qid] || {};

      if (qtype === 'multiple_choice') {
        const selected = answerState.answer;
        const correctAnswer = Number(q.correct_answer);
        return {
          question_id: qid,
          question_type: 'multiple_choice',
          subtopic,
          is_correct: Number.isInteger(selected) && selected === correctAnswer
        };
      }

      return {
        question_id: qid,
        question_type: 'open_question',
        subtopic,
        question_text: q.question_text || '',
        correct_answer: q.correct_answer || '',
        student_answer: typeof answerState.answer === 'string' ? answerState.answer : ''
      };
    })
  };
}

function buildMastery(results) {
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

function hideQuizLoader() {
  const loader = quizContainer.querySelector('.quiz-final-loader');
  if (loader) loader.remove();
}

function renderQuizResults(data) {
  hideQuizLoader();
  const resultBox = document.getElementById('quizCheckResult');
  if (!resultBox) return;

  const mastery = Array.isArray(data.mastery) ? data.mastery : buildMastery(Array.isArray(data.results) ? data.results : []);
  const allSubtopics = getQuizSubtopics();
  const filteredMastery = mastery.filter((item) => allSubtopics.includes(item.subtopic));
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

  resultBox.innerHTML = `
    <div class="quiz-results-card">
      <h3>Результаты теста</h3>
      <div class="quiz-results-grid">${rowsHtml || '<div class="status-message">Нет данных для анализа.</div>'}</div>
    </div>
  `;
  setTimeout(() => renderMathInContainer(resultBox), 30);
}

function renderQuizCheckError(message) {
  hideQuizLoader();
  const resultBox = document.getElementById('quizCheckResult');
  if (!resultBox) return;
  resultBox.innerHTML = `
    <div class="quiz-results-card">
      <h3>Не удалось проверить тест</h3>
      <div class="quiz-result-recommendation">${escapeHtml(message || 'Попробуйте отправить ответы на проверку еще раз.')}</div>
      <div class="next-btn-container error-action-row"><button id="retryQuizCheckBtn" class="next-question-btn">Попробовать еще раз</button></div>
    </div>
  `;
  const retryBtn = document.getElementById('retryQuizCheckBtn');
  if (retryBtn) retryBtn.addEventListener('click', submitQuiz);
}

function renderQuizAnalysisLoader(target) {
  target.innerHTML = `
    <div class="quiz-final-loader">
      <div class="quiz-spinner"></div>
      <div class="quiz-final-loader-title">Анализируем результаты...</div>
      <div class="quiz-final-loader-subtitle">Проверяем ответы и собираем статистику по подтемам</div>
    </div>
    <div id="quizCheckResult"></div>
  `;
}

function getQuizItemRoot() {
  return quizContainer.querySelector(`.quiz-item[data-question-idx="${quizState.index}"]`);
}

function applySelectedAnswer(answerIdx) {
  const root = getQuizItemRoot();
  const q = quizData[quizState.index];
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
    const nextBtn = root.querySelector('[data-next-question-btn]');
    if (nextBtn) nextBtn.hidden = false;
  }

  if (isCorrect) {
    setTimeout(() => nextQuestion(), 450);
  }
}

function renderQuiz() {
  if (!quizData.length) {
    quizContainer.innerHTML = '<div class="status-message">Тест недоступен</div>';
    return;
  }

  if (quizState.reviewMode && quizState.checkResult) {
    quizContainer.innerHTML = '<div id="quizCheckResult"></div>';
    renderQuizResults(quizState.checkResult);
    return;
  }

  if (quizState.index >= quizData.length) {
    if (quizState.checkStatus === 'done' && quizState.checkResult) {
      renderQuizResults(quizState.checkResult);
      return;
    }
    if (quizState.checkStatus === 'failed' && quizState.checkResult) {
      renderQuizCheckError(quizState.checkResult.recommendation || 'Не удалось проверить тест.');
      return;
    }
    if (quizState.checkStatus !== 'checking') {
      quizState.checkStatus = 'checking';
      renderQuizAnalysisLoader(quizContainer);
      setTimeout(() => submitQuiz(), 0);
      return;
    }
    renderQuizAnalysisLoader(quizContainer);
    return;
  }

  const q = quizData[quizState.index];
  const qid = String(q.question_id || quizState.index + 1);
  const answered = quizState.answers[qid] && quizState.answers[qid].answered;
  const open = q.question_type === 'open_ended' || q.question_type === 'open_question';

  let html = `<div class="quiz-item" data-question-idx="${quizState.index}">
    <div class="quiz-question">${quizState.index + 1}. ${markdownInlineToHtmlQuiz(q.question_text || '')}</div>`;

  if (!answered) {
    if (open) {
      html += '<div class="open-ended-area"><textarea id="openAnswer" class="open-ended-input" rows="4" placeholder="Введите ваш ответ..."></textarea><button class="check-answer-btn" id="checkAnswerBtn">Проверить ответ</button></div>';
    } else {
      const options = Array.isArray(q.options) ? q.options : [];
      for (let i = 0; i < options.length; i++) {
        html += `<div class="quiz-option" data-opt-index="${i}"><label>${markdownInlineToHtmlQuiz(options[i] || '')}</label></div>`;
      }
      html += `
        <div class="quiz-feedback" data-quiz-feedback hidden>
          <div class="explanation-box"><strong>Объяснение:</strong><br>${markdownInlineToHtmlQuiz(q.explanation || '')}</div>
          <div class="next-btn-container"><button class="next-question-btn" data-next-question-btn type="button" onclick="nextQuestion()">Далее</button></div>
        </div>
      `;
    }
  } else if (open) {
    html += `<div class="open-ended-area"><textarea class="open-ended-input" rows="4" disabled>${escapeHtml(quizState.answers[qid].answer || '')}</textarea></div>`;
    html += `<div class="explanation-box"><strong>Эталонный ответ:</strong><br>${markdownInlineToHtmlQuiz(q.correct_answer || '')}</div>`;
    html += '<div class="next-btn-container"><button class="next-question-btn" id="nextQuestionBtn" data-next-question-btn type="button">Далее</button></div>';
  } else {
    const user = quizState.answers[qid];
    const correct = user.answer === q.correct_answer;
    const options = Array.isArray(q.options) ? q.options : [];
    for (let i = 0; i < options.length; i++) {
      let cls = '';
      if (i === q.correct_answer) cls = 'correct-highlight';
      if (i === user.answer && i !== q.correct_answer) cls = 'wrong-highlight';
      html += `<div class="quiz-option ${cls}"><label>${markdownInlineToHtmlQuiz(options[i] || '')}</label></div>`;
    }
    if (!correct) {
      html += `<div class="explanation-box"><strong>Объяснение:</strong><br>${markdownInlineToHtmlQuiz(q.explanation || '')}</div>`;
      html += '<div class="next-btn-container"><button class="next-question-btn" id="nextQuestionBtn">Далее</button></div>';
    } else {
      if (quizState.index + 1 < quizData.length) {
        setTimeout(() => nextQuestion(), 450);
      } else {
        setTimeout(() => {
          quizState.index = quizData.length;
          renderQuiz();
        }, 450);
      }
    }
  }

  html += '</div>';
  quizContainer.innerHTML = html;

  if (!answered && !open) {
    quizContainer.querySelectorAll('.quiz-option').forEach((node) => {
      node.addEventListener('click', () => {
        const idx = parseInt(node.getAttribute('data-opt-index'), 10);
        selectAnswer(idx);
      });
    });
  }

  const checkBtn = document.getElementById('checkAnswerBtn');
  if (checkBtn) checkBtn.addEventListener('click', checkOpenEndedAnswer);

  const nextBtn = quizContainer.querySelector('[data-next-question-btn]');
  if (nextBtn) {
    nextBtn.onclick = nextQuestion;
    nextBtn.addEventListener('click', nextQuestion);
  }

  setTimeout(() => renderMathInContainer(quizContainer), 30);
}

function syncSummarySelection() {
  if (!summaryContainer) return;
  const active = normalizeTextBreaks(activeSummarySubtopic).trim().toLowerCase();
  summaryContainer.querySelectorAll('.toc-item').forEach((item) => {
    const isActive = normalizeTextBreaks(item.getAttribute('data-subtopic') || '').trim().toLowerCase() === active;
    item.classList.toggle('active', isActive);
  });
  summaryContainer.querySelectorAll('.summary-section').forEach((section) => {
    const isActive = normalizeTextBreaks(section.getAttribute('data-subtopic') || '').trim().toLowerCase() === active;
    section.classList.toggle('is-active', isActive);
  });
}

function renderSummary() {
  if (!summaryData.length) {
    summaryContainer.innerHTML = '<div class="status-message">Конспект недоступен</div>';
    return;
  }

  const tocHtml = `
    <div class="summary-toc">
      <h4>Оглавление</h4>
      <ul class="toc-list">
        ${summaryData.map((s, idx) => `<li class="toc-item ${((s.subtopic || '').trim().toLowerCase() === (activeSummarySubtopic || '').trim().toLowerCase()) ? 'active' : ''}" data-section-id="summary-section-${idx}" data-subtopic="${escapeHtml(s.subtopic || '')}">${escapeHtml(s.subtopic || `Раздел ${idx + 1}`)}</li>`).join('')}
      </ul>
    </div>
  `;
  const contentHtml = `
    <div class="summary-content">
      ${summaryData.map((s, idx) => `
        <section id="summary-section-${idx}" class="summary-section ${((s.subtopic || '').trim().toLowerCase() === (activeSummarySubtopic || '').trim().toLowerCase()) ? 'is-active' : ''}">
          <h3>${escapeHtml(s.subtopic || `Раздел ${idx + 1}`)}</h3>
          <div class="content">${formatMarkdownToHtml(s.content || '')}</div>
        </section>
      `).join('')}
    </div>
  `;
  summaryContainer.innerHTML = `<div class="summary-layout">${tocHtml}${contentHtml}</div>`;
  summaryContainer.querySelectorAll('.toc-item').forEach((item) => {
    item.addEventListener('click', () => {
      const subtopic = item.getAttribute('data-subtopic') || '';
      activeSummarySubtopic = subtopic;
      syncSummarySelection();
      setTimeout(() => {
        document.getElementById(item.getAttribute('data-section-id'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
    });
  });
  syncSummarySelection();
  setTimeout(() => renderMathInContainer(summaryContainer), 30);
}

async function submitQuiz() {
  const resultBox = document.getElementById('quizCheckResult');
  if (!resultBox) return;

  try {
    const res = await fetch(`/api/student/${generationId}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildCheckPayload())
    });

    const data = await res.json();
    if (!res.ok) {
      quizState.checkStatus = 'failed';
      quizState.checkResult = { recommendation: data.detail || 'Не удалось проверить тест.' };
      renderQuizCheckError(data.detail || 'Не удалось проверить тест.');
      return;
    }

    quizState.checkStatus = 'done';
    quizState.checkResult = data;
    renderQuizResults(data);
  } catch (_e) {
    quizState.checkStatus = 'failed';
    quizState.checkResult = { recommendation: 'Ошибка сети при проверке теста.' };
    renderQuizCheckError('Ошибка сети при проверке теста.');
  }
}

function getStorageKey() {
  return `quiz_progress_${generationId}`;
}

function saveQuizProgress() {
  if (!generationId) return;
  const payload = {
    index: quizState.index,
    answers: quizState.answers,
    checkStatus: quizState.checkStatus,
    checkResult: quizState.checkResult,
    reviewMode: quizState.reviewMode
  };
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(payload));
  } catch (_e) {
    // ignore
  }
}

function loadQuizProgress() {
  if (!generationId) return;
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return;
    const data = JSON.parse(raw);
    if (typeof data.index === 'number') quizState.index = data.index;
    if (data.answers) quizState.answers = data.answers;
    if (data.checkStatus) quizState.checkStatus = data.checkStatus;
    if (data.checkResult) quizState.checkResult = data.checkResult;
    if (typeof data.reviewMode === 'boolean') quizState.reviewMode = data.reviewMode;
  } catch (_e) {
    // ignore
  }
}

function clearQuizProgress() {
  if (!generationId) return;
  try {
    localStorage.removeItem(getStorageKey());
  } catch (_e) {
    // ignore
  }
}

function initQuizState() {
  quizState.index = 0;
  quizState.answers = {};
  quizState.checkStatus = 'idle';
  quizState.checkResult = null;
  quizState.reviewMode = false;
}

function renderActiveTab(tabName) {
  tabBtns.forEach((btn) => btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName));
  Object.values(panels).forEach((panel) => panel.classList.remove('active-pane'));
  panels[tabName].classList.add('active-pane');
  if (tabName === 'summary') renderSummary();
  if (tabName === 'quiz') renderQuiz();
}

function bindEvents() {
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      renderActiveTab(tab);
    });
  });
}

window.selectAnswer = function selectAnswer(answerIdx) {
  const q = quizData[quizState.index];
  if (!q) return;
  const qid = String(q.question_id || quizState.index + 1);
  if (quizState.answers[qid] && quizState.answers[qid].answered) return;
  quizState.answers[qid] = { answer: answerIdx, answered: true };
  saveQuizProgress();
  applySelectedAnswer(answerIdx);
};

window.checkOpenEndedAnswer = function checkOpenEndedAnswer() {
  const q = quizData[quizState.index];
  if (!q) return;
  const input = document.getElementById('openAnswer');
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;
  const qid = String(q.question_id || quizState.index + 1);
  quizState.answers[qid] = { answer: val, answered: true };
  saveQuizProgress();
  renderQuiz();
};

window.nextQuestion = function nextQuestion() {
  if (quizState.index + 1 < quizData.length) quizState.index += 1;
  else quizState.index = quizData.length;
  saveQuizProgress();
  renderQuiz();
};

(async function init() {
  generationId = getGenerationId();
  if (!generationId) {
    summaryContainer.innerHTML = '<div class="status-message">Ссылка недействительна</div>';
    quizContainer.innerHTML = '<div class="status-message">Ссылка недействительна</div>';
    return;
  }

  const res = await fetch(`/api/student/${generationId}`);
  if (!res.ok) {
    summaryContainer.innerHTML = '<div class="status-message">Материал недоступен</div>';
    quizContainer.innerHTML = '<div class="status-message">Материал недоступен</div>';
    return;
  }

  const data = await res.json();
  summaryData = Array.isArray(data.summary) ? data.summary : [];
  quizData = Array.isArray(data.quiz) ? data.quiz : [];
  initQuizState();
  activeSummarySubtopic = '';
  if (data.attempt) {
    quizState.reviewMode = true;
    quizState.checkStatus = 'done';
    quizState.checkResult = data.attempt;
    clearQuizProgress();
  } else {
    loadQuizProgress();
  }
  bindEvents();
  renderSummary();
  renderQuiz();
})();
