const transcriptChunks = [
  { text: "Сегодня мы разберем LU-разложение матриц - мощный метод решения систем линейных уравнений.", start_ms: 3000, is_final: false },
  { text: "LU-разложение позволяет эффективно решать множество систем с одной и той же матрицей.", start_ms: 11000, is_final: false },
  { text: "Основная идея: представить матрицу A как произведение нижней L и верхней U треугольных матриц.", start_ms: 19000, is_final: false },
  { text: "L - нижняя треугольная с единицами на диагонали, U - верхняя треугольная.", start_ms: 27000, is_final: false },
  { text: "Решение системы Ax = b сводится к двум шагам: прямая и обратная подстановка.", start_ms: 35000, is_final: false },
  { text: "Сложность LU-разложения O(n^3), но для N систем выигрыш колоссальный.", start_ms: 43000, is_final: false },
  { text: "Алгоритм получения LU-разложения основан на методе Гаусса.", start_ms: 51000, is_final: false },
  { text: "Важно: LU-разложение существует не для всех матриц, нужны ненулевые главные миноры.", start_ms: 59000, is_final: true }
];

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

const HISTORY_KEY = 'audio_generation_history_v1';
const HISTORY_LIMIT = 5;
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
const TASK_ID_COOKIE = 'adaptive_task_id';
const USER_PASSWORD_COOKIE = 'adaptive_user_password';
const COOKIE_MAX_AGE_DAYS = 7;
const STATUS_LABELS = {
  processing: 'Обработка...',
  completed: 'Готово',
  failed: 'Ошибка',
  expired: 'Недоступно'
};

let generationHistory = [];
let tasksById = {};
let activeTaskId = null;
let processingTaskId = null;

let fileUploaded = false;
let uploadedFileName = '';
let statusPollInterval = null;
let shouldAutoScrollTranscript = true;

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadStatusDiv = document.getElementById('uploadStatus');
const generateBtn = document.getElementById('generateBtn');
const resetUploadBtn = document.getElementById('resetUploadBtn');
const transcriptContainer = document.getElementById('transcriptContainer');
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
const historyDrawer = document.getElementById('historyDrawer');
const historyOverlay = document.getElementById('historyOverlay');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');
const questionTypeOverlay = document.getElementById('questionTypeOverlay');
const questionTypeDrawer = document.getElementById('questionTypeDrawer');
const closeQuestionTypeBtn = document.getElementById('closeQuestionTypeBtn');
const addMultipleChoiceBtn = document.getElementById('addMultipleChoiceBtn');
const addOpenEndedBtn = document.getElementById('addOpenEndedBtn');
const historySidebar = document.querySelector('.history-sidebar');
const pageLayout = document.querySelector('.page-layout');

const tabBtns = document.querySelectorAll('.tab-btn');
const panels = {
  transcript: document.getElementById('panelTranscript'),
  summary: document.getElementById('panelSummary'),
  quiz: document.getElementById('panelQuiz'),
  analytics: document.getElementById('panelAnalytics')
};

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
  }, 2600);
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
  } catch (e) {
    console.warn(e);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, (m) => (m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;'));
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes.toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
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

function jsonToMarkdown(data) {
  return data.map((section) => `## ${section.subtopic}\n\n${section.content}`).join('\n\n');
}

function markdownToJson(markdown) {
  const sections = [];
  const lines = markdown.split('\n');
  let currentSection = null;
  let currentContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) {
      if (currentSection) {
        sections.push({
          subtopic: currentSection,
          content: currentContent.join('\n').trim()
        });
      }
      currentSection = line.substring(3).trim();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  if (currentSection) {
    sections.push({
      subtopic: currentSection,
      content: currentContent.join('\n').trim()
    });
  }

  return sections;
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

function markdownInlineToHtml(text) {
  let html = escapeHtml(text || '');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  return html;
}

function summaryDataToEditorHtml(data) {
  return data
    .map((section) => {
      const heading = `<h2>${escapeHtml(section.subtopic || 'Раздел')}</h2>`;
      const body = formatMarkdownToHtml(section.content || '');
      return `${heading}${body}`;
    })
    .join('');
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

    if (tag === 'br') {
      result += '\n';
    } else if (tag === 'strong' || tag === 'b') {
      result += `**${nodesToMarkdown(children).trim()}**`;
    } else if (tag === 'em' || tag === 'i') {
      result += `*${nodesToMarkdown(children).trim()}*`;
    } else if (tag === 'li') {
      result += `* ${nodesToMarkdown(children).trim()}\n`;
    } else if (tag === 'ul' || tag === 'ol') {
      result += `${nodesToMarkdown(children)}\n`;
    } else if (tag === 'p' || tag === 'div') {
      const inner = nodesToMarkdown(children).trim();
      if (inner) result += `${inner}\n\n`;
    } else {
      result += nodesToMarkdown(children);
    }
  }

  return result;
}

function editorHtmlToSummaryData(editor) {
  const sections = [];
  let currentTitle = null;
  let currentNodes = [];

  const pushSection = () => {
    if (!currentTitle && currentNodes.length === 0) return;
    const markdown = nodesToMarkdown(currentNodes)
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    sections.push({
      subtopic: currentTitle || `Раздел ${sections.length + 1}`,
      content: markdown
    });
  };

  const children = Array.from(editor.childNodes);
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName.toLowerCase() === 'h2') {
      pushSection();
      currentTitle = (node.textContent || '').trim() || `Раздел ${sections.length + 1}`;
      currentNodes = [];
      continue;
    }
    currentNodes.push(node.cloneNode(true));
  }
  pushSection();

  return sections.filter((section) => section.subtopic.trim() || section.content.trim());
}

function generateTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function setCookie(name, value, days) {
  const maxAge = Math.max(1, Math.floor(days * 24 * 60 * 60));
  const encodedValue = encodeURIComponent(value || '');
  document.cookie = `${name}=${encodedValue}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function getCookie(name) {
  const encodedName = `${name}=`;
  const parts = (document.cookie || '').split(';');
  for (let i = 0; i < parts.length; i++) {
    const item = parts[i].trim();
    if (item.startsWith(encodedName)) {
      return decodeURIComponent(item.substring(encodedName.length));
    }
  }
  return '';
}

function generateUserPassword() {
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
}

function ensureUserPasswordCookie() {
  const existing = getCookie(USER_PASSWORD_COOKIE);
  if (existing) return existing;
  const generated = generateUserPassword();
  setCookie(USER_PASSWORD_COOKIE, generated, COOKIE_MAX_AGE_DAYS);
  return generated;
}

function syncSessionCookies(taskId, password) {
  const effectivePassword = password || ensureUserPasswordCookie();
  setCookie(TASK_ID_COOKIE, taskId || '', COOKIE_MAX_AGE_DAYS);
  setCookie(USER_PASSWORD_COOKIE, effectivePassword, COOKIE_MAX_AGE_DAYS);
}

function verifyTaskOwnership(taskId) {
  const historyEntry = generationHistory.find((item) => item.task_id === taskId);
  if (!historyEntry) return false;

  const effectivePassword = ensureUserPasswordCookie();
  if (!effectivePassword) return false;

  return (historyEntry.owner_password || '') === effectivePassword;
}

function readHistoryFromStorage() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && item.task_id).slice(0, HISTORY_LIMIT);
  } catch (_e) {
    return [];
  }
}

function persistHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(generationHistory.slice(0, HISTORY_LIMIT)));
}

function titleForEntry(entry) {
  if (entry.title && entry.title.trim()) return entry.title.trim();
  if (entry.file_name && entry.file_name.trim()) return entry.file_name.trim();
  const date = new Date(entry.created_at);
  if (Number.isNaN(date.getTime())) return 'Генерация';
  return `Генерация от ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.expired;
}

function setGenerateButtonState() {
  if (processingTaskId) {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Обработка...';
    generateBtn.classList.add('processing');
    return;
  }
  generateBtn.textContent = 'Обработать запись';
  generateBtn.disabled = false;
  generateBtn.classList.remove('processing');
}

function buildUploadStatusHtml(fileName, generationStatus) {
  const safeName = escapeHtml((fileName || '').slice(0, 40));
  if (!safeName) return '';

  if (generationStatus === 'processing') {
    return `<div class="file-info">Файл "${safeName}" загружен</div>`;
  }
  if (generationStatus === 'completed') {
    return `<div class="file-info">Файл "${safeName}" загружен</div>`;
  }
  if (generationStatus === 'failed') {
    return `<div class="file-info">Файл "${safeName}" загружен</div>`;
  }
  if (generationStatus === 'expired') {
    return `<div class="file-info">Файл "${safeName}" загружен</div>`;
  }
  return `<div class="file-info">Файл "${safeName}" загружен</div>`;
}

function syncUploadStatusWithActiveTask() {
  const task = getActiveTask();
  if (!task || !task.file_name) {
    if (!fileUploaded) uploadStatusDiv.innerHTML = '';
    return;
  }
  uploadStatusDiv.innerHTML = buildUploadStatusHtml(task.file_name, task.status);
}

function isSupportedMediaFile(file) {
  if (!file) return false;
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('audio/') || type.startsWith('video/')) return true;

  const name = (file.name || '').toLowerCase();
  return /\.(mp3|wav|m4a|aac|ogg|flac|mp4|mov|webm|avi|mkv|mpeg|mpg)$/.test(name);
}

function getActiveTask() {
  if (!activeTaskId) return null;
  return tasksById[activeTaskId] || null;
}

function getTaskQuizData(task) {
  if (!task || !Array.isArray(task.quizData)) return [];
  return task.quizData;
}

function setTabLoader(tabBtn, show) {
  const loader = tabBtn.querySelector('.tab-loader');
  if (loader) loader.style.display = show ? 'inline-block' : 'none';
}

function disableContentTabsForPending() {
  summaryTabBtn.disabled = true;
  summaryTabBtn.style.opacity = '0.5';
  quizTabBtn.disabled = true;
  quizTabBtn.style.opacity = '0.5';
  analyticsTabBtn.disabled = true;
  analyticsTabBtn.style.opacity = '0.5';
}

function setTabReadyState(tabBtn, isReady, isLoading) {
  tabBtn.disabled = !isReady;
  tabBtn.style.opacity = isReady ? '1' : '0.5';
  setTabLoader(tabBtn, isLoading);
}

function ensureTranscriptTabActiveIfNeeded() {
  const activeTabBtn = document.querySelector('.tab-btn.active');
  if (!activeTabBtn) return;
  const activeTab = activeTabBtn.getAttribute('data-tab');
  if (activeTab === 'summary' && summaryTabBtn.disabled) {
    document.querySelector('.tab-btn[data-tab="transcript"]').click();
  }
  if (activeTab === 'quiz' && quizTabBtn.disabled) {
    document.querySelector('.tab-btn[data-tab="transcript"]').click();
  }
  if (activeTab === 'analytics' && analyticsTabBtn.disabled) {
    document.querySelector('.tab-btn[data-tab="transcript"]').click();
  }
}

function renderTranscript() {
  const task = getActiveTask();
  if (!task) {
    transcriptContainer.innerHTML = '<div class="status-message">Загрузите файл и нажмите «Обработать файл»</div>';
    return;
  }

  if (task.status === 'failed') {
    transcriptContainer.innerHTML = '<div class="status-message">Ошибка обработки. Откройте другую генерацию или запустите новую.</div>';
    return;
  }

  if (task.status === 'expired') {
    transcriptContainer.innerHTML = '<div class="status-message">Генерация недоступна. Выберите другую из истории.</div>';
    return;
  }

  if (!task.transcriptLines.length && task.status === 'processing') {
    transcriptContainer.innerHTML = '<div class="status-message"><span class="spinner-small"></span> Обработка аудио...</div>';
    return;
  }

  if (!task.transcriptLines.length) {
    transcriptContainer.innerHTML = '<div class="status-message">Транскрипт пока недоступен</div>';
    return;
  }

  let html = '';
  for (let i = 0; i < task.transcriptLines.length; i++) {
    const line = task.transcriptLines[i];
    html += `<div class="transcript-line"><div class="timestamp">${formatTime(line.start_ms)}</div><div class="line-text">${escapeHtml(line.text)}</div></div>`;
  }
  if (task.status === 'processing') {
    html += '<div class="transcript-line" style="opacity:0.7;"><div class="timestamp"></div><div class="line-text"><span class="spinner-small"></span> Обработка...</div></div>';
  }
  transcriptContainer.innerHTML = html;

  if (shouldAutoScrollTranscript) {
    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
  }
}

function showSummaryPlaceholder(text) {
  summaryContainer.innerHTML = `<div class="status-message">${text}</div>`;
}

function showQuizPlaceholder(text) {
  quizContainer.innerHTML = `<div class="status-message">${text}</div>`;
}

function showAnalyticsPlaceholder(text) {
  analyticsContainer.innerHTML = `<div class="status-message">${text}</div>`;
}

function percentClass(value) {
  if (value >= 70) return 'good';
  if (value >= 40) return 'medium';
  return 'low';
}

function buildStudentLink(taskId) {
  const studentUrl = new URL('https://prototype.fastclass.ru/student/template.html');
  studentUrl.searchParams.set('task_id', taskId || '');
  studentUrl.searchParams.set('role', 'student');
  return studentUrl.toString();
}

function generateTaskQuizResults(task) {
  const taskQuizData = getTaskQuizData(task);
  const uniqueSubtopics = taskQuizData
    .map((question, idx) => {
      const raw = (question && question.subtopic ? question.subtopic : '').trim();
      return raw || `Подтема ${idx + 1}`;
    })
    .filter((item, idx, arr) => item && arr.indexOf(item) === idx);

  return uniqueSubtopics.map((subtopic) => ({
    subtopic,
    percent: Math.floor(Math.random() * 71) + 30
  }));
}

function renderTaskQuizAnalysisLoader() {
  quizContainer.innerHTML = `
    <div class="quiz-final-loader">
      <div class="quiz-spinner"></div>
      <div class="quiz-final-loader-title">Анализируем результаты...</div>
      <div class="quiz-final-loader-subtitle">Подготавливаем статистику по темам</div>
    </div>
  `;
}

function renderTaskQuizResults(task) {
  const rows = task.quizResultsData || [];
  const rowsHtml = rows
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

  const recommendation = 'Повторите подтему «Определение и форма LU-разложения»';
  quizContainer.innerHTML = `
    <div class="quiz-results-card">
      <h3>Результаты теста</h3>
      <div class="quiz-results-grid">${rowsHtml}</div>
      <div class="quiz-result-recommendation">${escapeHtml(recommendation)}</div>
    </div>
  `;
}

function generateAnalyticsFromTask(task) {
  const predefined = [82, 56, 28, 74, 41, 33];
  const sourceSubtopics = getTaskQuizData(task)
    .map((question, idx) => {
      const raw = (question && question.subtopic ? question.subtopic : '').trim();
      return raw || `Подтема ${idx + 1}`;
    })
    .filter((item, idx, arr) => item && arr.indexOf(item) === idx);

  const mastery = sourceSubtopics.slice(0, 6).map((subtopic, idx) => {
    const percent = predefined[idx % predefined.length];
    return {
      subtopic,
      percent
    };
  });

  const weakOrMedium = mastery.filter((item) => item.percent < 70);
  const recommendations = weakOrMedium.slice(0, 2).map((item) => {
    const action = item.percent < 40 ? 'Повторить базовые правила и разобрать 5 коротких примеров.' : 'Дать дополнительную практику: 8-10 заданий с проверкой.';
    return {
      subtopic: item.subtopic,
      action,
      priority: item.percent < 40 ? 'high' : 'medium'
    };
  });

  return {
    studentLink: buildStudentLink(task.task_id),
    studentsCompleted: 12,
    mastery,
    recommendations
  };
}

function renderAnalyticsContent() {
  const task = getActiveTask();
  if (!task) {
    showAnalyticsPlaceholder('Загрузите файл и нажмите «Обработать файл»');
    return;
  }

  if (task.status !== 'completed' || !task.analyticsReady) {
    showAnalyticsPlaceholder(task.status === 'processing' ? 'Аналитика будет доступна после завершения обработки' : 'Аналитика появится после теста');
    return;
  }

  const analytics = task.analyticsData || { studentLink: '', studentsCompleted: 0, mastery: [], recommendations: [] };
  const studentsCompleted = analytics.studentsCompleted;
  const hasStudentsCompleted = studentsCompleted > 0;
  const masteryCardClass = hasStudentsCompleted ? '' : ' analytics-card-disabled';
  const recommendationsCardClass = hasStudentsCompleted ? '' : ' analytics-card-disabled';
  const masteryHtml = analytics.mastery
    .map((item) => {
      const levelClass = percentClass(item.percent);
      return `
        <div class="analytics-row">
          <div class="analytics-subtopic">${escapeHtml(item.subtopic)}</div>
          <div class="analytics-progress-line">
            <div class="analytics-progress-fill ${levelClass}" style="width:${item.percent}%"></div>
          </div>
          <div class="analytics-percent">${item.percent}%</div>
        </div>
      `;
    })
    .join('');

  const recommendationsHtml =
    analytics.recommendations && analytics.recommendations.length
      ? analytics.recommendations
          .map((item) => {
            const accentClass = item.priority === 'high' ? 'high' : 'medium';
            return `<div class="analytics-reco ${accentClass}"><strong>${escapeHtml(item.subtopic)}:</strong> ${escapeHtml(item.action)}</div>`;
          })
          .join('')
      : '<div class="analytics-reco muted">Слабых подтем не найдено. Можно поддерживать текущий темп.</div>';

  analyticsContainer.innerHTML = `
    <div class="analytics-stack">
      <section class="analytics-card">
        <div class="analytics-title">Ссылка для учеников</div>
        <div class="analytics-link-wrap">
          <div class="analytics-link" id="studentLinkText">${escapeHtml(analytics.studentLink)}</div>
          <div class="analytics-link-actions">
            <button class="analytics-btn" type="button" onclick="copyStudentLink()">Скопировать ссылку</button>
            <button class="analytics-btn" type="button" onclick="openStudentLink()">Открыть</button>
          </div>
        </div>
        <div class="analytics-meta">Прошли материал: ${studentsCompleted} учеников</div>
      </section>

      <section class="analytics-card${masteryCardClass}">
        <div class="analytics-title">Освоение подтем</div>
        <div class="analytics-matrix">${masteryHtml}</div>
      </section>

      <section class="analytics-card${recommendationsCardClass}">
        <div class="analytics-title">Рекомендации</div>
        <div class="analytics-reco-list">${recommendationsHtml}</div>
      </section>
    </div>
  `;
}

function renderSummaryContent() {
  const task = getActiveTask();
  if (!task) {
    showSummaryPlaceholder('Загрузите файл и нажмите «Обработать файл»');
    return;
  }

  if (task.status !== 'completed' || !task.summaryReady) {
    showSummaryPlaceholder(task.status === 'processing' ? 'Конспект будет доступен после завершения обработки' : 'Конспект недоступен');
    return;
  }

  if (!task.summaryData.length) {
    showSummaryPlaceholder('Конспект пока недоступен');
    return;
  }

  if (task.isEditMode) {
    const editorHtml = summaryDataToEditorHtml(task.summaryData);
    const toolbar = `
      <div class="markdown-editor-toolbar">
        <button class="toolbar-btn" onclick="applyRichCommand('h2')">Заголовок H2</button>
        <button class="toolbar-btn" onclick="applyRichCommand('bold')">Жирный</button>
        <button class="toolbar-btn" onclick="applyRichCommand('italic')">Курсив</button>
        <button class="toolbar-btn" onclick="applyRichCommand('unorderedList')">Список</button>
        <button class="toolbar-btn" onclick="insertFormulaBlock()">Формула</button>
      </div>
      <div id="richSummaryEditor" class="markdown-editor rich-editor" contenteditable="true">${editorHtml}</div>
    `;
    summaryContainer.innerHTML = `<div class="markdown-editor-container">${toolbar}</div>`;
    return;
  }

  let tocHtml = '<div class="summary-toc"><h4>📑 Оглавление</h4><ul class="toc-list">';
  let contentHtml = '<div class="summary-content">';
  for (let idx = 0; idx < task.summaryData.length; idx++) {
    const section = task.summaryData[idx];
    const id = `section-${idx}`;
    tocHtml += `<li class="toc-item" onclick="document.getElementById('${id}').scrollIntoView({ behavior: 'smooth' })">${escapeHtml(section.subtopic)}</li>`;
    contentHtml += `<div id="${id}" class="summary-section"><h3>${escapeHtml(section.subtopic)}</h3><div class="content">${formatMarkdownToHtml(section.content)}</div></div>`;
  }
  tocHtml += '</ul></div>';
  contentHtml += '</div>';
  summaryContainer.innerHTML = `<div class="summary-layout">${tocHtml}${contentHtml}</div>`;
  setTimeout(() => renderMathInContainer(summaryContainer), 30);
}

function renderQuizContent() {
  const task = getActiveTask();
  if (!task) {
    showQuizPlaceholder('Загрузите файл и нажмите «Обработать файл»');
    return;
  }

  if (task.status !== 'completed' || !task.quizReady) {
    showQuizPlaceholder(task.status === 'processing' ? 'Тест будет доступен после завершения обработки' : 'Тест недоступен');
    return;
  }

  const taskQuizData = getTaskQuizData(task);
  if (!taskQuizData.length) {
    showQuizPlaceholder('Тест пока недоступен');
    return;
  }

  if (task.isQuizEditMode) {
    renderQuizEditor(task);
    return;
  }

  if (task.quizIndex >= taskQuizData.length) {
    if (task.quizResultsReady) {
      renderTaskQuizResults(task);
      return;
    }
    if (!task.quizAnalyzingResults) {
      task.quizAnalyzingResults = true;
      renderTaskQuizAnalysisLoader();
      if (!task.quizResultsTimer) {
        task.quizResultsTimer = setTimeout(() => {
          task.quizResultsData = generateTaskQuizResults(task);
          task.quizResultsReady = true;
          task.quizAnalyzingResults = false;
          task.quizResultsTimer = null;
          task.isQuizEditMode = false;
          if (getActiveTask() && getActiveTask().task_id === task.task_id && editQuizBtn) {
            editQuizBtn.textContent = '✏️ Редактировать тест';
          }
          if (getActiveTask() && getActiveTask().task_id === task.task_id) {
            renderTaskQuizResults(task);
          }
        }, 5000);
      }
      return;
    }
    renderTaskQuizAnalysisLoader();
    return;
  }

  const q = taskQuizData[task.quizIndex];
  const answered = task.quizAnswers[task.quizIndex] && task.quizAnswers[task.quizIndex].answered;
  const isOpenEnded = q.question_type === 'open_ended';
  let html = `<div class="quiz-item" data-question-idx="${task.quizIndex}"><div class="quiz-question">${task.quizIndex + 1}. ${escapeHtml(q.question_text)}</div>`;

  if (!answered) {
    if (isOpenEnded) {
      html += '<div class="open-ended-area"><textarea id="openAnswer" class="open-ended-input" rows="4" placeholder="Введите ваш развернутый ответ..."></textarea><button class="check-answer-btn" onclick="checkOpenEndedAnswer()">Проверить ответ</button></div>';
    } else {
      for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
        html += `<div class="quiz-option" data-opt-index="${optIdx}"><label>${q.options[optIdx]}</label></div>`;
      }
    }
  } else {
    const userData = task.quizAnswers[task.quizIndex];
    if (isOpenEnded) {
      const safeAnswer = escapeHtml((userData && userData.answer) || '');
      html += `<div class="open-ended-area"><textarea id="openAnswer" class="open-ended-input" rows="4" disabled>${safeAnswer}</textarea></div>`;
      html += `<div class="explanation-box"><strong>Эталонный ответ:</strong><br>${markdownInlineToHtml(q.correct_answer)}</div>`;
      html += '<div class="next-btn-container"><button class="next-question-btn" onclick="nextQuestion()">Далее</button></div>';
    } else {
      const isCorrect = userData.answer === q.correct_answer;
      for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
        let highlightClass = '';
        if (optIdx === q.correct_answer) highlightClass = 'correct-highlight';
        if (optIdx === userData.answer && optIdx !== q.correct_answer) highlightClass = 'wrong-highlight';
        html += `<div class="quiz-option ${highlightClass}" data-opt-index="${optIdx}"><label>${q.options[optIdx]}</label></div>`;
      }
      if (!isCorrect) {
        html += `<div class="explanation-box"><strong>Объяснение:</strong><br>${q.explanation}</div>`;
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
  const task = getActiveTask();
  if (!task) return;
  const taskQuizData = getTaskQuizData(task);
  const q = taskQuizData[task.quizIndex];
  if (!q) return;

  if (task.quizAnswers[task.quizIndex] && task.quizAnswers[task.quizIndex].answered) return;
  task.quizAnswers[task.quizIndex] = { answer: answerIdx, answered: true };
  renderAnalyticsContent();

  const quizItem = document.querySelector(`.quiz-item[data-question-idx="${task.quizIndex}"]`);
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
  const task = getActiveTask();
  if (!task) return;
  const input = document.getElementById('openAnswer');
  if (!input) return;

  const userAnswer = input.value.trim();
  if (!userAnswer) return;
  task.quizAnswers[task.quizIndex] = { answer: userAnswer, answered: true };
  renderAnalyticsContent();
  renderQuizContent();
};

window.nextQuestion = function nextQuestion() {
  const task = getActiveTask();
  if (!task) return;
  const taskQuizData = getTaskQuizData(task);

  if (task.quizIndex + 1 < taskQuizData.length) {
    task.quizIndex += 1;
  } else {
    task.quizIndex = taskQuizData.length;
  }
  renderQuizContent();
};

function renderQuizEditor(task) {
  const taskQuizData = getTaskQuizData(task);
  const editorHtml = taskQuizData
    .map((q, idx) => {
      const typeLabel = q.question_type === 'open_ended' ? 'Открытый' : 'С выбором';
      const questionOptions = Array.isArray(q.options) && q.options.length ? q.options : ['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4'];
      const optionsHtml =
        q.question_type === 'multiple_choice'
          ? questionOptions
              .map((opt, optIdx) => {
                return `
                  <div class="quiz-edit-option">
                    <span class="quiz-edit-option-label">${optIdx + 1}.</span>
                    <input class="quiz-edit-input" data-field="option" data-opt-index="${optIdx}" value="${escapeHtml(opt || '')}" />
                  </div>
                `;
              })
              .join('') +
            `<div class="quiz-edit-correct-row">Правильный вариант:
              <select class="quiz-edit-select" data-field="correct_answer">
                ${questionOptions.map((_, optIdx) => `<option value="${optIdx}" ${optIdx === q.correct_answer ? 'selected' : ''}>${optIdx + 1}</option>`).join('')}
              </select>
            </div>`
          : '';

      const answerHtml =
        q.question_type === 'open_ended'
          ? `<div class="quiz-edit-answer-row">
               <div class="quiz-edit-label">Эталонный ответ</div>
               <textarea class="quiz-edit-textarea" data-field="correct_answer" rows="3">${escapeHtml(q.correct_answer || '')}</textarea>
             </div>`
          : '';

      const explanationHtml = `
        <div class="quiz-edit-answer-row">
          <div class="quiz-edit-label">Объяснение</div>
          <textarea class="quiz-edit-textarea" data-field="explanation" rows="3">${escapeHtml(q.explanation || '')}</textarea>
        </div>
      `;

      return `
        <div class="quiz-edit-item" data-question-index="${idx}" data-question-type="${q.question_type}">
          <div class="quiz-edit-top">
            <div class="quiz-edit-number">Вопрос ${idx + 1}</div>
            <div class="quiz-edit-type">${typeLabel}</div>
          </div>
          <div class="quiz-edit-label">Подтема</div>
          <input class="quiz-edit-input" data-field="subtopic" value="${escapeHtml(q.subtopic || '')}" />
          <div class="quiz-edit-label">Текст вопроса</div>
          <textarea class="quiz-edit-textarea" data-field="question_text" rows="3">${escapeHtml(q.question_text || '')}</textarea>
          ${optionsHtml}
          ${answerHtml}
          ${explanationHtml}
          <div class="quiz-edit-actions">
            <button class="quiz-edit-action-btn danger" type="button" onclick="removeQuizQuestion(${idx})">Удалить вопрос</button>
          </div>
        </div>
      `;
    })
    .join('');

  quizContainer.innerHTML = `
    <div class="quiz-editor">
      ${editorHtml}
      <div class="quiz-edit-global-actions">
        <div class="dropdown">
          <button class="quiz-edit-action-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">Добавить вопрос</button>
          <ul class="dropdown-menu">
            <li><button class="dropdown-item" type="button" onclick="addQuizQuestion('multiple_choice')">С выбором</button></li>
            <li><button class="dropdown-item" type="button" onclick="addQuizQuestion('open_ended')">Открытый</button></li>
          </ul>
        </div>
      </div>
    </div>
  `;
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

function renderHistory() {
  const currentPassword = ensureUserPasswordCookie();
  const visibleHistory = currentPassword ? generationHistory.filter((item) => (item.owner_password || '') === currentPassword) : [];
  const shouldShowHistory = visibleHistory.length > 0;
  updateHistoryVisibility(shouldShowHistory);

  if (!visibleHistory.length) {
    const emptyHtml = '<div class="history-empty">Здесь будут ваши последние обработки</div>';
    historyList.innerHTML = emptyHtml;
    historyListMobile.innerHTML = emptyHtml;
    return;
  }

  const html = visibleHistory
    .map((item) => {
      const statusClass = `status-${item.status || 'expired'}`;
      const activeClass = item.is_active ? 'active' : '';
      const title = escapeHtml(titleForEntry(item));
      const meta = `${formatDateTime(item.created_at)}`;
      const isProcessing = item.status === 'processing';

      return `<article class="history-item ${activeClass}" data-task-id="${item.task_id}">
          <div class="history-item-title">${title}</div>
          <div class="history-item-row">
            <span class="history-status ${statusClass}">${isProcessing ? '<span class="spinner-dot"></span>' : ''}${getStatusLabel(item.status)}</span>
          </div>
          <div class="history-meta">${meta}</div>
          <div class="history-actions">
            <button class="history-btn" type="button" data-action="open" data-task-id="${item.task_id}">Открыть</button>
            <button class="history-btn danger" type="button" data-action="delete" data-task-id="${item.task_id}">Удалить</button>
          </div>
        </article>`;
    })
    .join('');

  historyList.innerHTML = html;
  historyListMobile.innerHTML = html;
}

function updateHistoryVisibility(visible) {
  if (historySidebar) historySidebar.hidden = !visible;
  if (historyToggleBtn) historyToggleBtn.hidden = !visible;
  if (pageLayout) pageLayout.classList.toggle('has-history', visible);

  if (!visible) {
    closeHistoryDrawer();
  }
}

function moveActiveTaskToHistory() {
  if (!activeTaskId) return;

  const previousActiveTaskId = activeTaskId;
  generationHistory = generationHistory.map((item) => ({
    ...item,
    is_active: false
  }));
  persistHistory();

  activeTaskId = null;
  shouldAutoScrollTranscript = true;

  if (processingTaskId === previousActiveTaskId) {
    processingTaskId = null;
  }

  renderHistory();
  renderActiveTask();
}

function markActiveInHistory(taskId) {
  generationHistory = generationHistory.map((item) => ({
    ...item,
    is_active: item.task_id === taskId
  }));
  persistHistory();
}

function setActiveTask(taskId, shouldRender = true) {
  if (!verifyTaskOwnership(taskId)) {
    showPopover('Эта задача не принадлежит текущему пользователю.');
    return;
  }

  activeTaskId = taskId;
  shouldAutoScrollTranscript = true;
  markActiveInHistory(taskId);
  const historyEntry = generationHistory.find((item) => item.task_id === taskId);
  syncSessionCookies(taskId, historyEntry?.owner_password || ensureUserPasswordCookie());

  if (!tasksById[taskId]) {
    tasksById[taskId] = {
      task_id: taskId,
      transcriptLines: [],
      summaryData: [],
      quizData: [],
      analyticsData: null,
      summaryReady: false,
      quizReady: false,
      analyticsReady: false,
      quizIndex: 0,
      quizAnswers: [],
      quizAnalyzingResults: false,
      quizResultsReady: false,
      quizResultsData: [],
      quizResultsTimer: null,
      isEditMode: false,
      isQuizEditMode: false,
      status: generationHistory.find((item) => item.task_id === taskId)?.status || 'expired'
    };
  }

  renderHistory();
  syncUploadStatusWithActiveTask();
  if (shouldRender) renderActiveTask();
}

function addHistoryEntry(entry) {
  generationHistory = generationHistory.filter((item) => item.task_id !== entry.task_id);
  generationHistory.unshift({ ...entry, is_active: true });

  if (generationHistory.length > HISTORY_LIMIT) {
    const trimmed = generationHistory.slice(HISTORY_LIMIT);
    for (let i = 0; i < trimmed.length; i++) {
      delete tasksById[trimmed[i].task_id];
    }
  }

  generationHistory = generationHistory.slice(0, HISTORY_LIMIT);
  persistHistory();
  renderHistory();
}

function updateHistoryEntry(taskId, patch) {
  let hasChanges = false;
  generationHistory = generationHistory.map((item) => {
    if (item.task_id !== taskId) return item;
    hasChanges = true;
    return { ...item, ...patch };
  });
  if (hasChanges) {
    persistHistory();
    renderHistory();
  }
}

function removeGeneration(taskId) {
  const task = tasksById[taskId];
  if (task && task.quizResultsTimer) {
    clearTimeout(task.quizResultsTimer);
    task.quizResultsTimer = null;
  }
  generationHistory = generationHistory.filter((item) => item.task_id !== taskId);
  delete tasksById[taskId];

  if (processingTaskId === taskId) {
    processingTaskId = null;
    setGenerateButtonState();
  }

  if (activeTaskId === taskId) {
    activeTaskId = null;
    if (generationHistory.length) {
      setActiveTask(generationHistory[0].task_id);
    } else {
      persistHistory();
      renderHistory();
      renderActiveTask();
    }
  } else {
    persistHistory();
    renderHistory();
  }
}

function renderActiveTask() {
  const task = getActiveTask();

  if (task && !verifyTaskOwnership(task.task_id)) {
    activeTaskId = null;
    renderHistory();
  }

  const safeTask = getActiveTask();
  if (!safeTask) {
    disableContentTabsForPending();
    setTabLoader(summaryTabBtn, false);
    setTabLoader(quizTabBtn, false);
    setTabLoader(analyticsTabBtn, false);
    ensureTranscriptTabActiveIfNeeded();
    transcriptContainer.innerHTML = '<div class="status-message">Загрузите файл и нажмите «Обработать файл»</div>';
    summaryContainer.innerHTML = '<div class="status-message">Конспект появится после обработки</div>';
    quizContainer.innerHTML = '<div class="status-message">Тест появится после обработки</div>';
    analyticsContainer.innerHTML = '<div class="status-message">Аналитика появится после обработки</div>';
    editSummaryBtn.disabled = true;
    editSummaryBtn.textContent = '✏️ Редактировать конспект';
    editQuizBtn.disabled = true;
    editQuizBtn.textContent = '✏️ Редактировать тест';
    return;
  }

  editSummaryBtn.textContent = safeTask.isEditMode ? 'Сохранить' : '✏️ Редактировать конспект';
  editQuizBtn.textContent = safeTask.isQuizEditMode ? 'Сохранить' : '✏️ Редактировать тест';
  editSummaryBtn.disabled = safeTask.status !== 'completed' || !safeTask.summaryReady;
  editQuizBtn.disabled = safeTask.status !== 'completed' || !safeTask.quizReady;

  const canStillPrepareContent = safeTask.status === 'processing' || safeTask.status === 'completed';
  const isSummaryStage = canStillPrepareContent && !safeTask.summaryReady;
  const isPostSummaryStage = canStillPrepareContent && safeTask.summaryReady;

  const summaryLoading = isSummaryStage;
  const quizLoading = isPostSummaryStage && !safeTask.quizReady;
  const analyticsLoading = isPostSummaryStage && !safeTask.analyticsReady;
  setTabReadyState(summaryTabBtn, safeTask.summaryReady, summaryLoading);
  setTabReadyState(quizTabBtn, safeTask.quizReady, quizLoading);
  setTabReadyState(analyticsTabBtn, safeTask.analyticsReady, analyticsLoading);

  ensureTranscriptTabActiveIfNeeded();

  renderTranscript();
  renderSummaryContent();
  renderQuizContent();
  renderAnalyticsContent();
}

function createTaskModel(base) {
  return {
    task_id: base.task_id,
    owner_password: base.owner_password || '',
    status: base.status,
    file_name: base.file_name,
    title: base.title,
    created_at: base.created_at,
    transcriptLines: [],
    summaryData: [],
    quizData: [],
    analyticsData: null,
    summaryReady: false,
    quizReady: false,
    analyticsReady: false,
    quizIndex: 0,
    quizAnswers: [],
    quizAnalyzingResults: false,
    quizResultsReady: false,
    quizResultsData: [],
    quizResultsTimer: null,
    isEditMode: false,
    isQuizEditMode: false,
    simulationTimer: null
  };
}

function setTaskStatus(taskId, status) {
  const task = tasksById[taskId];
  if (!task) return;
  task.status = status;
  updateHistoryEntry(taskId, { status });

  if (activeTaskId === taskId) renderActiveTask();
}

function startTaskSimulation(taskId) {
  const task = tasksById[taskId];
  if (!task) return;

  const sourceLines = [...transcriptChunks];
  let pointer = 0;

  function step() {
    const currentTask = tasksById[taskId];
    if (!currentTask || currentTask.status !== 'processing') return;

    if (pointer >= sourceLines.length) {
      processingTaskId = null;
      setTaskStatus(taskId, 'completed');
      setGenerateButtonState();

      currentTask.summaryData = JSON.parse(JSON.stringify(summaryData));
      currentTask.quizData = JSON.parse(JSON.stringify(quizData));
      setTimeout(() => {
        const freshTask = tasksById[taskId];
        if (!freshTask || freshTask.status !== 'completed') return;
        freshTask.summaryReady = true;
        if (activeTaskId === taskId) renderActiveTask();
      }, 1800);

      setTimeout(() => {
        const freshTask = tasksById[taskId];
        if (!freshTask || freshTask.status !== 'completed') return;
        freshTask.quizReady = true;
        freshTask.analyticsData = generateAnalyticsFromTask(freshTask);
        freshTask.analyticsReady = true;
        if (activeTaskId === taskId) renderActiveTask();
      }, 4200);
      return;
    }

    currentTask.transcriptLines.push({ ...sourceLines[pointer] });
    pointer += 1;
    if (activeTaskId === taskId) renderTranscript();
    currentTask.simulationTimer = setTimeout(step, 1400);
  }

  task.simulationTimer = setTimeout(step, 5000);
}

function simulateFileUpload(file) {
  if (!file) return;

  if (file.size > MAX_UPLOAD_BYTES) {
    showPopover('Файл больше 200 МБ. Загрузите файл меньшего размера.');
    fileInput.value = '';
    return;
  }

  if (!isSupportedMediaFile(file)) {
    showPopover('Неподдерживаемый тип файла. Загрузите аудио или видео.');
    fileInput.value = '';
    return;
  }

  uploadStatusDiv.innerHTML = `<div class="file-info"><span class="loader"></span> Загрузка "${escapeHtml(file.name.slice(0, 28))}"...</div>`;
  fileUploaded = false;
  setGenerateButtonState();

  setTimeout(() => {
    uploadedFileName = file.name;
    uploadStatusDiv.innerHTML = `<div class="file-info">Файл "${escapeHtml(file.name.slice(0, 28))}" успешно загружен</div>`;
    fileUploaded = true;
    setGenerateButtonState();
  }, 1300);
}

function resetUpload() {
  moveActiveTaskToHistory();
  fileUploaded = false;
  uploadedFileName = '';
  uploadStatusDiv.innerHTML = '';
  fileInput.value = '';
  dropZone.classList.remove('drag-over');
  setGenerateButtonState();
}

function startGeneration() {
  if (!fileUploaded) {
    alert('Сначала загрузите аудиофайл');
    return;
  }
  if (processingTaskId) return;
  const currentUserPassword = ensureUserPasswordCookie();

  const taskId = generateTaskId();
  const createdAt = new Date().toISOString();
  const historyEntry = {
    task_id: taskId,
    owner_password: currentUserPassword,
    file_name: uploadedFileName || 'audio.mp3',
    title: uploadedFileName || 'Аудио',
    created_at: createdAt,
    status: 'processing',
    is_active: true
  };

  tasksById[taskId] = createTaskModel(historyEntry);
  syncSessionCookies(taskId, currentUserPassword);
  addHistoryEntry(historyEntry);
  setActiveTask(taskId, false);
  renderActiveTask();
  syncUploadStatusWithActiveTask();

  processingTaskId = taskId;
  setGenerateButtonState();
  startTaskSimulation(taskId);
}

function enterEditMode() {
  const task = getActiveTask();
  if (!task || !task.summaryData.length) {
    alert('Конспект еще не сгенерирован');
    return;
  }
  task.isEditMode = true;
  editSummaryBtn.textContent = 'Сохранить';
  renderSummaryContent();
}

function saveSummary() {
  const task = getActiveTask();
  if (!task) return;

  const editor = document.getElementById('richSummaryEditor');
  if (!editor) return;

  const newData = editorHtmlToSummaryData(editor);
  if (!newData.length) {
    alert('Ошибка: добавьте хотя бы один раздел с заголовком H2');
    return;
  }

  task.summaryData = newData;
  task.isEditMode = false;
  editSummaryBtn.textContent = '✏️ Редактировать конспект';
  renderSummaryContent();
}

function onEditButtonClick() {
  const task = getActiveTask();
  if (!task || !task.summaryData.length) {
    alert('Конспект еще не сгенерирован');
    return;
  }

  if (task.isEditMode) {
    saveSummary();
  } else {
    enterEditMode();
  }
}

function enterQuizEditMode() {
  const task = getActiveTask();
  if (!task || !task.quizReady || !getTaskQuizData(task).length) {
    alert('Тест еще не сгенерирован');
    return;
  }

  task.isQuizEditMode = true;
  editQuizBtn.textContent = 'Сохранить';
  renderQuizContent();
}

function saveQuiz() {
  const task = getActiveTask();
  if (!task) return;

  const editorItems = Array.from(quizContainer.querySelectorAll('.quiz-edit-item'));
  if (!editorItems.length) {
    alert('Ошибка: не удалось получить данные теста');
    return;
  }

  const parsedQuiz = editorItems.map((item, index) => {
    const questionType = item.getAttribute('data-question-type');
    const questionText = (item.querySelector('[data-field="question_text"]')?.value || '').trim();
    const explanationText = (item.querySelector('[data-field="explanation"]')?.value || '').trim();
    const subtopicText = (item.querySelector('[data-field="subtopic"]')?.value || '').trim();

    if (questionType === 'multiple_choice') {
      const optionInputs = Array.from(item.querySelectorAll('[data-field="option"]'));
      const options = optionInputs.map((input) => (input.value || '').trim());
      const correctRaw = parseInt(item.querySelector('[data-field="correct_answer"]')?.value || '0', 10);
      const safeCorrect = Number.isNaN(correctRaw) ? 0 : Math.max(0, Math.min(correctRaw, Math.max(options.length - 1, 0)));
      return {
        question_id: index + 1,
        question_text: questionText,
        question_type: 'multiple_choice',
        options,
        correct_answer: safeCorrect,
        explanation: explanationText,
        subtopic: subtopicText
      };
    }

    return {
      question_id: index + 1,
      question_text: questionText,
      question_type: 'open_ended',
      options: null,
      correct_answer: (item.querySelector('[data-field="correct_answer"]')?.value || '').trim(),
      explanation: explanationText,
      subtopic: subtopicText
    };
  });

  const hasEmptyQuestion = parsedQuiz.some((q) => !q.question_text);
  if (hasEmptyQuestion) {
    alert('Заполните текст всех вопросов перед сохранением');
    return;
  }

  task.quizData = parsedQuiz;
  if (task.quizResultsTimer) {
    clearTimeout(task.quizResultsTimer);
    task.quizResultsTimer = null;
  }
  task.quizAnswers = [];
  task.quizIndex = 0;
  task.quizAnalyzingResults = false;
  task.quizResultsReady = false;
  task.quizResultsData = [];
  task.analyticsData = generateAnalyticsFromTask(task);
  task.isQuizEditMode = false;
  editQuizBtn.textContent = '✏️ Редактировать тест';
  renderQuizContent();
  renderAnalyticsContent();
}

window.openQuestionTypeDrawer = function openQuestionTypeDrawer() {
  const task = getActiveTask();
  if (!task || !task.isQuizEditMode) return;
  questionTypeDrawer.classList.add('open');
  questionTypeDrawer.setAttribute('aria-hidden', 'false');
  questionTypeOverlay.hidden = false;
};

function closeQuestionTypeDrawer() {
  questionTypeDrawer.classList.remove('open');
  questionTypeDrawer.setAttribute('aria-hidden', 'true');
  questionTypeOverlay.hidden = true;
}

function addQuizQuestion(questionType) {
  const task = getActiveTask();
  if (!task) return;

  const taskQuizData = getTaskQuizData(task);
  const newType = questionType === 'open_ended' ? 'open_ended' : 'multiple_choice';

  const newQuestion =
    newType === 'open_ended'
      ? {
          question_id: taskQuizData.length + 1,
          question_text: 'Новый открытый вопрос',
          question_type: 'open_ended',
          options: null,
          correct_answer: '',
          explanation: '',
          subtopic: ''
        }
      : {
          question_id: taskQuizData.length + 1,
          question_text: 'Новый вопрос с выбором',
          question_type: 'multiple_choice',
          options: ['Вариант 1', 'Вариант 2', 'Вариант 3', 'Вариант 4'],
          correct_answer: 0,
          explanation: '',
          subtopic: ''
        };

  taskQuizData.push({
    ...newQuestion
  });
  renderQuizEditor(task);
  closeQuestionTypeDrawer();
}

window.removeQuizQuestion = function removeQuizQuestion(index) {
  const task = getActiveTask();
  if (!task) return;

  const taskQuizData = getTaskQuizData(task);
  if (taskQuizData.length <= 1) {
    showPopover('В тесте должен остаться хотя бы один вопрос.');
    return;
  }

  taskQuizData.splice(index, 1);
  renderQuizEditor(task);
};

function onEditQuizButtonClick() {
  const task = getActiveTask();
  if (!task || !task.quizReady || !getTaskQuizData(task).length) {
    alert('Тест еще не сгенерирован');
    return;
  }

  if (task.isQuizEditMode) {
    saveQuiz();
  } else {
    enterQuizEditMode();
  }
}

function getTaskStatusFromServer(taskId) {
  const task = tasksById[taskId];
  if (!task) return 'expired';
  return task.status;
}

function pollStatuses() {
  for (let i = 0; i < generationHistory.length; i++) {
    const item = generationHistory[i];
    if (item.status !== 'processing') continue;

    const serverStatus = getTaskStatusFromServer(item.task_id);
    if (serverStatus !== item.status) {
      updateHistoryEntry(item.task_id, { status: serverStatus });
      if (tasksById[item.task_id]) tasksById[item.task_id].status = serverStatus;
      if (activeTaskId === item.task_id) renderActiveTask();
    }
  }
}

function openHistoryDrawer() {
  historyDrawer.classList.add('open');
  historyDrawer.setAttribute('aria-hidden', 'false');
  historyOverlay.hidden = false;
}

function closeHistoryDrawer() {
  historyDrawer.classList.remove('open');
  historyDrawer.setAttribute('aria-hidden', 'true');
  historyOverlay.hidden = true;
}

function handleHistoryClick(event) {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;

  const action = btn.getAttribute('data-action');
  const taskId = btn.getAttribute('data-task-id');
  if (!taskId) return;

  if (action === 'open') {
    const historyEntry = generationHistory.find((item) => item.task_id === taskId);
    if (!historyEntry) {
      showPopover('Задача не найдена.');
      return;
    }
    if (!verifyTaskOwnership(taskId)) {
      showPopover('Эта задача не принадлежит текущему пользователю.');
      return;
    }
    syncSessionCookies(taskId, historyEntry.owner_password || ensureUserPasswordCookie());
    setActiveTask(taskId);
    closeHistoryDrawer();
    return;
  }

  if (action === 'delete') {
    removeGeneration(taskId);
  }
}

window.copyStudentLink = async function copyStudentLink() {
  const task = getActiveTask();
  const link = task?.analyticsData?.studentLink;
  if (!link) return;

  try {
    await navigator.clipboard.writeText(link);
    showPopover('Ссылка скопирована');
  } catch (_e) {
    showPopover('Не удалось скопировать ссылку');
  }
};

window.openStudentLink = function openStudentLink() {
  const task = getActiveTask();
  const link = task?.analyticsData?.studentLink;
  if (!link) return;
  window.open(link, '_blank', 'noopener,noreferrer');
};

function hydrateState() {
  closeQuestionTypeDrawer();
  generationHistory = readHistoryFromStorage().slice(0, HISTORY_LIMIT);
  const cookiePassword = ensureUserPasswordCookie();
  if (cookiePassword) {
    let migrated = false;
    generationHistory = generationHistory.map((item) => {
      if (item.owner_password) return item;
      migrated = true;
      return { ...item, owner_password: cookiePassword };
    });
    if (migrated) persistHistory();
  }

  if (generationHistory.length) {
    generationHistory = generationHistory.map((item) => ({ ...item, is_active: false }));
    persistHistory();

    for (let i = 0; i < generationHistory.length; i++) {
      const item = generationHistory[i];
      tasksById[item.task_id] = createTaskModel(item);
      tasksById[item.task_id].status = item.status;
    }
  }

  renderHistory();
  renderActiveTask();
  setGenerateButtonState();
  syncUploadStatusWithActiveTask();

  if (!statusPollInterval) {
    statusPollInterval = setInterval(pollStatuses, 2500);
  }
}

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
    if (e.dataTransfer.files.length) simulateFileUpload(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) simulateFileUpload(e.target.files[0]);
  });

  generateBtn.addEventListener('click', startGeneration);
  resetUploadBtn.addEventListener('click', resetUpload);
  editSummaryBtn.addEventListener('click', onEditButtonClick);
  editQuizBtn.addEventListener('click', onEditQuizButtonClick);

  historyList.addEventListener('click', handleHistoryClick);
  historyListMobile.addEventListener('click', handleHistoryClick);

  if (historyToggleBtn) historyToggleBtn.addEventListener('click', openHistoryDrawer);
  if (closeHistoryBtn) closeHistoryBtn.addEventListener('click', closeHistoryDrawer);
  if (historyOverlay) historyOverlay.addEventListener('click', closeHistoryDrawer);
  if (closeQuestionTypeBtn) closeQuestionTypeBtn.addEventListener('click', closeQuestionTypeDrawer);
  if (questionTypeOverlay) questionTypeOverlay.addEventListener('click', closeQuestionTypeDrawer);
  if (addMultipleChoiceBtn) addMultipleChoiceBtn.addEventListener('click', () => addQuizQuestion('multiple_choice'));
  if (addOpenEndedBtn) addOpenEndedBtn.addEventListener('click', () => addQuizQuestion('open_ended'));

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const tab = btn.getAttribute('data-tab');
      tabBtns.forEach((otherBtn) => otherBtn.classList.remove('active'));
      btn.classList.add('active');
      Object.values(panels).forEach((panel) => panel.classList.remove('active-pane'));
      panels[tab].classList.add('active-pane');

      if (tab === 'summary') renderSummaryContent();
      if (tab === 'quiz') renderQuizContent();
      if (tab === 'analytics') renderAnalyticsContent();
      if (tab === 'transcript') renderTranscript();
    });
  });

  transcriptContainer.addEventListener('scroll', () => {
    const threshold = 16;
    const nearBottom =
      transcriptContainer.scrollTop + transcriptContainer.clientHeight >= transcriptContainer.scrollHeight - threshold;
    shouldAutoScrollTranscript = nearBottom;
  });
}

hydrateState();
bindEvents();
