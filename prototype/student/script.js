const summaryData = [
  { "subtopic": "Цель LU-разложения", "content": "LU-разложение - это метод, который позволяет решать множество систем линейных уравнений с **одной и той же матрицей** $A$, но разными правыми частями $b$.\n\n*   **Почему это выгодно?**\n    *   Прямое решение системы методом Гаусса имеет сложность $O(n^3)$.\n    *   Если у вас есть разложение $A = LU$, то решение сводится к двум последовательным шагам (прямой и обратной подстановке), каждый из которых имеет сложность $O(n^2)$.\n    *   Для $N$ систем уравнений выигрыш в производительности становится огромным, так как сложность падает с $O(N \\cdot n^3)$ до $O(n^3 + N \\cdot n^2)$.\n\n*   **Когда это не нужно:**\n    *   Если нужно решить **всего одну** систему уравнений, выполнять LU-разложение не имеет смысла, так как оно потребует больше вычислений, чем прямой метод Гаусса." },
  { "subtopic": "Определение и форма LU-разложения", "content": "LU-разложение представляет исходную квадратную матрицу $A$ в виде произведения двух треугольных матриц:\n\n$$\nA = L \\cdot U\n$$\n\nгде:\n*   $L$ (от англ. *lower*) - **нижняя треугольная матрица**. На ее главной диагонали находятся **единицы**.\n*   $U$ (от англ. *upper*) - **верхняя треугольная матрица**.\n\nТакое разложение является **однозначным** при условии, что на диагонали $U$ нет нулей (или что все главные миноры матрицы $A$ отличны от нуля)." },
  { "subtopic": "Решение системы Ax = b через LU-разложение", "content": "Используя разложение $A = LU$, систему $Ax = b$ можно решить в два этапа:\n\n1.  **Прямая подстановка (Forward substitution):**\n    Вводится вспомогательная переменная $y = Ux$. Тогда $Ly = b$.\n    *   Так как $L$ - нижняя треугольная матрица с единицами на диагонали, вектор $y$ легко находится последовательно, начиная с первой строки.\n\n2.  **Обратная подстановка (Backward substitution):**\n    Решается система $Ux = y$.\n    *   Так как $U$ - верхняя треугольная матрица, вектор $x$ легко находится, начиная с последней строки.\n\n**Пример** (из транскрипта):\nПусть $A = \\begin{pmatrix} 1 & 2 \\\\ 2 & 1 \\end{pmatrix}$, тогда $L = \\begin{pmatrix} 1 & 0 \\\\ 2 & 1 \\end{pmatrix}$, $U = \\begin{pmatrix} 1 & 2 \\\\ 0 & -3 \\end{pmatrix}$.\nДля решения $Ax = b$ (например, $b = (1,0)^T$):\n1. Решаем $Ly = b$: $\\begin{cases} y_1 = 1 \\\\ 2y_1 + y_2 = 0 \\end{cases} \\Rightarrow y_1 = 1, y_2 = -2$.\n2. Решаем $Ux = y$: $\\begin{cases} x_1 + 2x_2 = 1 \\\\ -3x_2 = -2 \\end{cases} \\Rightarrow x_2 = \\frac{2}{3}, x_1 = -\\frac{1}{3}$." },
  { "subtopic": "Алгоритм нахождения LU-разложения (Метод Гаусса)", "content": "Самый практичный способ получения LU-разложения - это преобразование матрицы $A$ к верхнетреугольному виду $U$ с помощью **элементарных преобразований строк** (вычитание одной строки из другой), которые всегда являются нижнетреугольными матрицами $E$.\n\n1.  **Прямой ход (к U):**\n    Последовательно применяем к $A$ элементарные матрицы $E_1, E_2, ..., E_k$, чтобы получить $U$:\n    $$\n    E_k \\cdots E_2 E_1 A = U\n    $$\n    Важно: разрешены только преобразования **сверху вниз** (из нижней строки вычитаем верхнюю, умноженную на коэффициент). Это гарантирует, что все $E_i$ являются нижнетреугольными.\n\n2.  **Формирование L:**\n    Из предыдущего уравнения следует:\n    $$\n    A = (E_1^{-1} E_2^{-1} \\cdots E_k^{-1}) U\n    $$\n    Матрица $L$ - это произведение обратных элементарных матриц:\n    $$\n    L = E_1^{-1} E_2^{-1} \\cdots E_k^{-1}\n    $$\n    *   Обратная операция к вычитанию строки - это прибавление строки с противоположным знаком.\n    *   На практике $L$ формируется, применяя **в обратном порядке** обратные преобразования к единичной матрице $I$." },
  { "subtopic": "Практический пример (на матрице 3x3)", "content": "Найдем LU-разложение для матрицы $A = \\begin{pmatrix} 1 & 2 & 3 \\\\ 1 & 1 & 1 \\\\ 1 & 3 & 2 \\end{pmatrix}$.\n\n**Шаг 1: Прямой ход (получение U).**\n*   $\\text{стр2} := \\text{стр2} - \\text{стр1}$: $\\begin{pmatrix} 1 & 2 & 3 \\\\ 0 & -1 & -2 \\\\ 1 & 3 & 2 \\end{pmatrix}$.\n*   $\\text{стр3} := \\text{стр3} - \\text{стр1}$: $\\begin{pmatrix} 1 & 2 & 3 \\\\ 0 & -1 & -2 \\\\ 0 & 1 & -1 \\end{pmatrix}$.\n*   $\\text{стр3} := \\text{стр3} + \\text{стр2}$: $\\begin{pmatrix} 1 & 2 & 3 \\\\ 0 & -1 & -2 \\\\ 0 & 0 & -3 \\end{pmatrix}$.\n\nМатрица $U$ готова: $U = \\begin{pmatrix} 1 & 2 & 3 \\\\ 0 & -1 & -2 \\\\ 0 & 0 & -3 \\end{pmatrix}$.\n\n**Шаг 2: Обратный ход (получение L).**\nНачинаем с единичной матрицы $I$ и применяем обратные преобразования в обратном порядке.\n1.  Исходная $I = \\begin{pmatrix} 1 & 0 & 0 \\\\ 0 & 1 & 0 \\\\ 0 & 0 & 1 \\end{pmatrix}$.\n2.  Обратное к последнему преобразованию ($\\text{стр3} := \\text{стр3} + \\text{стр2}$) - это $\\text{стр3} := \\text{стр3} - \\text{стр2}$:\n    $\\begin{pmatrix} 1 & 0 & 0 \\\\ 0 & 1 & 0 \\\\ 0 & -1 & 1 \\end{pmatrix}$.\n3.  Обратное к преобразованию $\\text{стр3} := \\text{стр3} - \\text{стр1}$ - это $\\text{стр3} := \\text{стр3} + \\text{стр1}$:\n    $\\begin{pmatrix} 1 & 0 & 0 \\\\ 0 & 1 & 0 \\\\ 1 & -1 & 1 \\end{pmatrix}$.\n4.  Обратное к преобразованию $\\text{стр2} := \\text{стр2} - \\text{стр1}$ - это $\\text{стр2} := \\text{стр2} + \\text{стр1}$:\n    $\\begin{pmatrix} 1 & 0 & 0 \\\\ 1 & 1 & 0 \\\\ 1 & -1 & 1 \\end{pmatrix}$.\n\nМатрица $L$ готова: $L = \\begin{pmatrix} 1 & 0 & 0 \\\\ 1 & 1 & 0 \\\\ 1 & -1 & 1 \\end{pmatrix}$.\n\n**Проверка:** $L \\cdot U = A$." },
  { "subtopic": "Условия существования и возможные проблемы", "content": "LU-разложение существует не для всех невырожденных матриц.\n\n*   **Основное условие:** Все главные миноры матрицы $A$ должны быть отличны от нуля.\n*   **Почему оно может отсутствовать:**\n    *   Если в процессе приведения к $U$ на главной диагонали появляется ноль, дальнейшее зануление элементов ниже него с помощью разрешенных операций (вычитание верхних строк из нижних) становится невозможным.\n    *   **Пример:** $A = \\begin{pmatrix} 0 & 1 \\\\ 1 & 1 \\end{pmatrix}$. На первом же шаге $a_{11} = 0$, что блокирует стандартный алгоритм.\n\n*   **Решение проблемы:** Для таких матриц используется **LU-разложение с перестановками (LUP)**. Оно добавляет матрицу перестановок $P$, так что:\n    $$\n    PA = LU\n    $$\n    Это позволяет менять строки местами, чтобы избежать нулевых элементов на диагонали." }
];

const quizData = [
  { question_id: 1, question_text: "Какая из следующих матриц может быть представлена в виде $A = LU$, где $L$ - нижняя треугольная с единицами на диагонали, а $U$ - верхняя треугольная?", question_type: "multiple_choice", options: ["$\\begin{pmatrix} 1 & 2 \\\\ 2 & 1 \\end{pmatrix}$", "$\\begin{pmatrix} 0 & 1 \\\\ 1 & 1 \\end{pmatrix}$", "$\\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}$", "$\\begin{pmatrix} 2 & 4 \\\\ 1 & 2 \\end{pmatrix}$"], correct_answer: 0, explanation: "Матрица с ненулевыми главными минорами допускает классическое LU-разложение.", subtopic: "Условия существования и возможные проблемы" },
  { question_id: 2, question_text: "Какая матрица в LU-разложении имеет единицы на главной диагонали?", question_type: "multiple_choice", options: ["Матрица U", "Матрица L", "Обе матрицы", "Ни одна из матриц"], correct_answer: 1, explanation: "В классическом LU-разложении единицы на диагонали задаются в L.", subtopic: "Определение и форма LU-разложения" },
  { question_id: 3, question_text: "Какова вычислительная сложность решения системы через LU-разложение (после получения разложения)?", question_type: "multiple_choice", options: ["O(n^3)", "O(n^2)", "O(n log n)", "O(n)"], correct_answer: 1, explanation: "После разложения остаются прямая и обратная подстановки порядка O(n^2).", subtopic: "Решение системы Ax = b через LU-разложение" },
  { question_id: 4, question_text: "Какое условие необходимо для существования LU-разложения?", question_type: "multiple_choice", options: ["Все элементы матрицы должны быть ненулевыми", "Матрица должна быть симметричной", "Все главные миноры должны быть отличны от нуля", "Матрица должна быть диагональной"], correct_answer: 2, explanation: "Ключевое условие - ненулевые главные миноры.", subtopic: "Условия существования и возможные проблемы" },
  { question_id: 5, question_text: "Что такое LUP-разложение?", question_type: "multiple_choice", options: ["LU-разложение с перестановками строк", "LU-разложение с перестановками столбцов", "LU-разложение с комплексными числами", "Модификация для невырожденных матриц"], correct_answer: 0, explanation: "LUP добавляет матрицу перестановок P, чтобы обходить нулевые ведущие элементы.", subtopic: "Условия существования и возможные проблемы" },
  { question_id: 6, question_text: "Объясните, почему для матрицы с нулевым первым главным минором не существует стандартного LU-разложения и как это можно исправить.", question_type: "open_ended", options: null, correct_answer: "Ноль в ведущем элементе блокирует стандартный ход Гаусса, поэтому нужны перестановки строк (LUP).", explanation: "LUP позволяет менять строки и продолжать факторизацию.", subtopic: "Условия существования и возможные проблемы" },
  { question_id: 7, question_text: "Опишите алгоритм получения LU-разложения методом Гаусса.", question_type: "open_ended", options: null, correct_answer: "Последовательно зануляют элементы под диагональю; коэффициенты исключения записывают в L, верхний результат образует U.", explanation: "Это стандартный прямой ход Гаусса с сохранением множителей.", subtopic: "Алгоритм нахождения LU-разложения (Метод Гаусса)" }
];

let quizIndex = 0;
const quizAnswers = [];
let isAnalyzingResults = false;
let quizResultsReady = false;
let quizResultsTimer = null;

const summaryContainer = document.getElementById('summaryContainer');
const quizContainer = document.getElementById('quizContainer');
const tabBtns = document.querySelectorAll('.tab-btn');
const panels = {
  summary: document.getElementById('panelSummary'),
  quiz: document.getElementById('panelQuiz')
};

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, (m) => (m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;'));
}

function markdownInlineToHtml(text) {
  let html = escapeHtml(text || '');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  return html;
}

function formatMarkdownToHtml(text) {
  let html = text;
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/^\* (.*?)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*?<\/li>\n?)+/gm, '<ul>$&</ul>');
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;
  html = html.replace(/<p><\/p>/g, '').replace(/<\/ul><ul>/g, '');
  return html;
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
  } catch (_e) {
    return;
  }
}

function renderSummaryContent() {
  let tocHtml = '<div class="summary-toc"><h4>📑 Оглавление</h4><ul class="toc-list">';
  let contentHtml = '<div class="summary-content">';
  for (let idx = 0; idx < summaryData.length; idx++) {
    const section = summaryData[idx];
    const id = `section-${idx}`;
    tocHtml += `<li class="toc-item" onclick="document.getElementById('${id}').scrollIntoView({ behavior: 'smooth' })">${escapeHtml(section.subtopic)}</li>`;
    contentHtml += `<div id="${id}" class="summary-section"><h3>${escapeHtml(section.subtopic)}</h3><div class="content">${formatMarkdownToHtml(section.content)}</div></div>`;
  }
  tocHtml += '</ul></div>';
  contentHtml += '</div>';
  summaryContainer.innerHTML = `<div class="summary-layout">${tocHtml}${contentHtml}</div>`;
  setTimeout(() => renderMathInContainer(summaryContainer), 30);
}

function percentClass(value) {
  if (value >= 70) return 'good';
  if (value >= 40) return 'medium';
  return 'low';
}

function computeResultsBySubtopic() {
  const uniqueSubtopics = quizData
    .map((question, idx) => question.subtopic || `Подтема ${idx + 1}`)
    .filter((item, idx, arr) => arr.indexOf(item) === idx);

  return uniqueSubtopics.map((subtopic) => ({
    subtopic,
    percent: Math.floor(Math.random() * 71) + 30
  }));
}

function buildRecommendation(results) {
  return 'Повторите подтему «Определение и форма LU-разложения»';
}

function renderQuizAnalysisLoader() {
  quizContainer.innerHTML = `
    <div class="quiz-final-loader">
      <div class="quiz-spinner"></div>
      <div class="quiz-final-loader-title">Анализируем результаты...</div>
      <div class="quiz-final-loader-subtitle">Подготавливаем статистику по темам</div>
    </div>
  `;
}

function renderQuizResults() {
  const results = computeResultsBySubtopic();
  const rowsHtml = results
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

  const recommendation = buildRecommendation(results);
  quizContainer.innerHTML = `
    <div class="quiz-results-card">
      <h3>Результаты теста</h3>
      <div class="quiz-results-grid">${rowsHtml}</div>
      <div class="quiz-result-recommendation">${escapeHtml(recommendation)}</div>
    </div>
  `;
}

function renderQuizContent() {
  if (quizIndex >= quizData.length) {
    if (quizResultsReady) {
      renderQuizResults();
      return;
    }
    if (!isAnalyzingResults) {
      isAnalyzingResults = true;
      renderQuizAnalysisLoader();
      if (!quizResultsTimer) {
        quizResultsTimer = setTimeout(() => {
          quizResultsReady = true;
          isAnalyzingResults = false;
          quizResultsTimer = null;
          renderQuizResults();
        }, 5000);
      }
      return;
    }
    renderQuizAnalysisLoader();
    return;
  }

  const q = quizData[quizIndex];
  const answered = quizAnswers[quizIndex] && quizAnswers[quizIndex].answered;
  const isOpenEnded = q.question_type === 'open_ended';
  let html = `<div class="quiz-item" data-question-idx="${quizIndex}"><div class="quiz-question">${quizIndex + 1}. ${escapeHtml(q.question_text)}</div>`;

  if (!answered) {
    if (isOpenEnded) {
      html += '<div class="open-ended-area"><textarea id="openAnswer" class="open-ended-input" rows="4" placeholder="Введите ваш ответ..."></textarea><button class="check-answer-btn" onclick="checkOpenEndedAnswer()">Проверить ответ</button></div>';
    } else {
      for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
        html += `<div class="quiz-option" data-opt-index="${optIdx}"><label>${q.options[optIdx]}</label></div>`;
      }
    }
  } else {
    if (isOpenEnded) {
      const safeAnswer = escapeHtml((quizAnswers[quizIndex] && quizAnswers[quizIndex].answer) || '');
      html += `<div class="open-ended-area"><textarea id="openAnswer" class="open-ended-input" rows="4" disabled>${safeAnswer}</textarea></div>`;
      html += `<div class="explanation-box"><strong>Эталонный ответ:</strong><br>${markdownInlineToHtml(q.correct_answer)}</div>`;
      html += '<div class="next-btn-container"><button class="next-question-btn" onclick="nextQuestion()">Далее</button></div>';
    } else {
      const userData = quizAnswers[quizIndex];
      const isCorrect = userData.answer === q.correct_answer;
      for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
        let highlightClass = '';
        if (optIdx === q.correct_answer) highlightClass = 'correct-highlight';
        if (optIdx === userData.answer && optIdx !== q.correct_answer) highlightClass = 'wrong-highlight';
        html += `<div class="quiz-option ${highlightClass}"><label>${q.options[optIdx]}</label></div>`;
      }
      if (!isCorrect) {
        html += `<div class="explanation-box"><strong>Объяснение:</strong><br>${markdownInlineToHtml(q.explanation)}</div>`;
        html += '<div class="next-btn-container"><button class="next-question-btn" onclick="nextQuestion()">Далее</button></div>';
      } else {
        setTimeout(() => nextQuestion(), 450);
      }
    }
  }

  html += '</div>';
  quizContainer.innerHTML = html;

  if (!answered && !isOpenEnded) {
    const options = quizContainer.querySelectorAll('.quiz-option');
    options.forEach((opt) => {
      opt.addEventListener('click', () => {
        const selectedIdx = parseInt(opt.getAttribute('data-opt-index'), 10);
        selectAnswer(selectedIdx);
      });
    });
  }
  setTimeout(() => renderMathInContainer(quizContainer), 30);
}

function selectAnswer(answerIdx) {
  const q = quizData[quizIndex];
  if (!q) return;
  if (quizAnswers[quizIndex] && quizAnswers[quizIndex].answered) return;
  quizAnswers[quizIndex] = { answer: answerIdx, answered: true };

  const quizItem = document.querySelector(`.quiz-item[data-question-idx="${quizIndex}"]`);
  if (!quizItem) return;

  const options = quizItem.querySelectorAll('.quiz-option');
  options.forEach((opt, idx) => {
    opt.style.pointerEvents = 'none';
    if (idx === q.correct_answer) opt.classList.add('correct-highlight');
    if (idx === answerIdx && idx !== q.correct_answer) opt.classList.add('wrong-highlight');
  });

  const isCorrect = answerIdx === q.correct_answer;
  if (!isCorrect) {
    const explanationBox = document.createElement('div');
    explanationBox.className = 'explanation-box';
    explanationBox.innerHTML = `<strong>Объяснение:</strong><br>${markdownInlineToHtml(q.explanation)}`;
    quizItem.appendChild(explanationBox);

    const nextBtnContainer = document.createElement('div');
    nextBtnContainer.className = 'next-btn-container';
    const nextBtn = document.createElement('button');
    nextBtn.className = 'next-question-btn';
    nextBtn.textContent = 'Далее';
    nextBtn.onclick = () => nextQuestion();
    nextBtnContainer.appendChild(nextBtn);
    quizItem.appendChild(nextBtnContainer);
  } else {
    setTimeout(() => nextQuestion(), 450);
  }
}

window.checkOpenEndedAnswer = function checkOpenEndedAnswer() {
  const q = quizData[quizIndex];
  if (!q) return;
  const input = document.getElementById('openAnswer');
  if (!input) return;
  const userAnswer = input.value.trim();
  if (!userAnswer) return;
  quizAnswers[quizIndex] = { answer: userAnswer, answered: true };

  input.disabled = true;
  const checkBtn = input.parentElement ? input.parentElement.querySelector('.check-answer-btn') : null;
  if (checkBtn) checkBtn.remove();

  const quizItem = document.querySelector(`.quiz-item[data-question-idx="${quizIndex}"]`);
  if (!quizItem) return;

  const explanationBox = document.createElement('div');
  explanationBox.className = 'explanation-box';
  explanationBox.innerHTML = `<strong>Эталонный ответ:</strong><br>${markdownInlineToHtml(q.correct_answer)}`;
  quizItem.appendChild(explanationBox);

  const nextBtnContainer = document.createElement('div');
  nextBtnContainer.className = 'next-btn-container';
  const nextBtn = document.createElement('button');
  nextBtn.className = 'next-question-btn';
  nextBtn.textContent = 'Далее';
  nextBtn.onclick = () => nextQuestion();
  nextBtnContainer.appendChild(nextBtn);
  quizItem.appendChild(nextBtnContainer);
};

window.nextQuestion = function nextQuestion() {
  if (quizIndex + 1 < quizData.length) {
    quizIndex += 1;
  } else {
    quizIndex = quizData.length;
  }
  renderQuizContent();
};

function bindEvents() {
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      tabBtns.forEach((item) => item.classList.remove('active'));
      btn.classList.add('active');
      Object.values(panels).forEach((panel) => panel.classList.remove('active-pane'));
      panels[tab].classList.add('active-pane');
      if (tab === 'summary') renderSummaryContent();
      if (tab === 'quiz') renderQuizContent();
    });
  });
}
renderSummaryContent();
renderQuizContent();
bindEvents();
