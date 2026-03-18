let currentLang = 'en';
let langData = {};
let isDarkMode = true;

document.addEventListener('DOMContentLoaded', () => {
    loadAppInfo();
    loadPreferences();
    loadLanguage(currentLang);
    setupEvents();
    updateThemeUI();
    generatePassword();
});

async function loadAppInfo() {
    try {
        const response = await fetch('app.json');
        if (!response.ok) throw new Error('Failed to load app.json');

        const data = await response.json();

        if (data.version) {
            document.getElementById('app-version').textContent = data.version;
        } else {
            document.getElementById('app-version').textContent = 'version unknown';
            document.getElementById('app-version').style.background = 'var(--red)';
        }
    } catch (error) {
        console.error('Could not load app info:', error);
        document.getElementById('app-version').textContent = 'version unknown';
        document.getElementById('app-version').style.background = 'var(--red)';
    }
}

function setupEvents() {
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('lang-select').addEventListener('change', (e) => loadLanguage(e.target.value));

    const num = document.getElementById('length-num');
    const range = document.getElementById('length-range');
    num.addEventListener('input', () => { range.value = num.value; generatePassword(); });
    range.addEventListener('input', () => { num.value = range.value; generatePassword(); });

    document.getElementById('toggle-advanced').addEventListener('click', (e) => {
        document.getElementById('advanced-panel').classList.toggle('hidden');
        updateAdvancedLabel();
    });

    document.getElementById('generate-btn').addEventListener('click', generatePassword);

    document.getElementById('btn-copy').addEventListener('click', () => {
        const text = document.getElementById('password-display').textContent;
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('btn-copy');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `<span style="color:var(--primary); font-weight:bold;">✓</span>`;
            setTimeout(() => btn.innerHTML = originalHTML, 1500);
        });
    });

    ['uppercase', 'numbers', 'symbols', 'exclude-ambiguous', 'no-start-symbol',
        'custom-lower', 'custom-upper', 'custom-numbers', 'custom-symbols'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => {
                generatePassword();
                savePreferencesIfEnabled();
            });
        });

    document.getElementById('save-prefs').addEventListener('change', savePreferencesIfEnabled);
}

function toggleTheme() {
    isDarkMode = !isDarkMode;
    updateThemeUI();
    savePreferencesIfEnabled();
}

function updateThemeUI() {
    const body = document.body;
    const btn = document.getElementById('theme-toggle');
    if (isDarkMode) {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        btn.textContent = "Light Mode";
    } else {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        btn.textContent = "Dark Mode";
    }
}

function updateAdvancedLabel() {
    const panel = document.getElementById('advanced-panel');
    const txt = langData.advanced_settings || "Advanced Settings";
    document.getElementById('toggle-advanced').textContent = panel.classList.contains('hidden') ? txt + " ▾" : txt + " ▴";
}

async function loadLanguage(lang) {
    try {
        const res = await fetch(`lang/${lang}.json`);
        langData = await res.json();
        currentLang = lang;
        document.getElementById('lang-select').value = lang;
        applyTranslations();
    } catch (e) { console.error(e); }
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (langData[key]) el.textContent = langData[key];
    });
    updateAdvancedLabel();
}

function generatePassword() {
    const length = parseInt(document.getElementById('length-num').value);

    let cLower = document.getElementById('custom-lower').value;
    let cUpper = document.getElementById('custom-upper').value;
    let cNum = document.getElementById('custom-numbers').value;
    let cSym = document.getElementById('custom-symbols').value;

    if (document.getElementById('exclude-ambiguous').checked) {
        const amb = /[il1Lo0O]/g;
        cLower = cLower.replace(amb, '');
        cUpper = cUpper.replace(amb, '');
        cNum = cNum.replace(amb, '');
    }

    const pools = [];
    if (cLower) pools.push(cLower);
    if (document.getElementById('uppercase').checked && cUpper) pools.push(cUpper);
    if (document.getElementById('numbers').checked && cNum) pools.push(cNum);

    let nonSymbolPool = pools.join('');

    if (document.getElementById('symbols').checked && cSym) {
        pools.push(cSym);
    }

    const fullPool = pools.join('') || "abcdef";
    if (!nonSymbolPool) nonSymbolPool = fullPool;

    let passwordChars = [];

    // 1. Guarantee at least one char from each active pool
    const guaranteedPools = pools.slice(0, length);
    for (const p of guaranteedPools) {
        const rand = new Uint32Array(1);
        window.crypto.getRandomValues(rand);
        passwordChars.push(p[rand[0] % p.length]);
    }

    // 2. Fill the rest
    const remainingCount = length - passwordChars.length;
    if (remainingCount > 0) {
        const randArr = new Uint32Array(remainingCount);
        window.crypto.getRandomValues(randArr);
        for (let i = 0; i < remainingCount; i++) {
            passwordChars.push(fullPool[randArr[i] % fullPool.length]);
        }
    }

    // 3. Shuffle
    for (let i = passwordChars.length - 1; i > 0; i--) {
        const rand = new Uint32Array(1);
        window.crypto.getRandomValues(rand);
        const j = rand[0] % (i + 1);
        [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
    }

    // 4. Handle "no-start-symbol"
    const noStartSymbol = document.getElementById('no-start-symbol').checked;
    if (noStartSymbol && cSym && cSym.includes(passwordChars[0])) {
        for (let i = 1; i < passwordChars.length; i++) {
            if (!cSym.includes(passwordChars[i])) {
                [passwordChars[0], passwordChars[i]] = [passwordChars[i], passwordChars[0]];
                break;
            }
        }
    }

    const password = passwordChars.join('');
    document.getElementById('password-display').textContent = password;

    const entropy = Math.floor(length * Math.log2(fullPool.length));
    document.getElementById('entropy-display').textContent = `Entropy: ${entropy} bits`;
}

function savePreferencesIfEnabled() {
    if (document.getElementById('save-prefs').checked) {
        const prefs = {
            lang: currentLang,
            darkMode: isDarkMode,
            length: document.getElementById('length-num').value,
            opts: {
                upper: document.getElementById('uppercase').checked,
                num: document.getElementById('numbers').checked,
                sym: document.getElementById('symbols').checked,
                amb: document.getElementById('exclude-ambiguous').checked,
                noStart: document.getElementById('no-start-symbol').checked
            },
            custom: {
                l: document.getElementById('custom-lower').value,
                u: document.getElementById('custom-upper').value,
                n: document.getElementById('custom-numbers').value,
                s: document.getElementById('custom-symbols').value
            },
            isSaved: true
        };
        localStorage.setItem('xpass_prefs', JSON.stringify(prefs));
    } else {
        localStorage.removeItem('xpass_prefs');
    }
}

function loadPreferences() {
    const saved = JSON.parse(localStorage.getItem('xpass_prefs'));
    if (saved && saved.isSaved) {
        document.getElementById('save-prefs').checked = true;
        isDarkMode = saved.darkMode;

        if (saved.lang) currentLang = saved.lang;
        if (saved.length) {
            document.getElementById('length-num').value = saved.length;
            document.getElementById('length-range').value = saved.length;
        }
        if (saved.opts) {
            document.getElementById('uppercase').checked = saved.opts.upper;
            document.getElementById('numbers').checked = saved.opts.num;
            document.getElementById('symbols').checked = saved.opts.sym;
            document.getElementById('exclude-ambiguous').checked = saved.opts.amb;
            document.getElementById('no-start-symbol').checked = saved.opts.noStart || false;
        }
        if (saved.custom) {
            document.getElementById('custom-lower').value = saved.custom.l;
            document.getElementById('custom-upper').value = saved.custom.u;
            document.getElementById('custom-numbers').value = saved.custom.n;
            document.getElementById('custom-symbols').value = saved.custom.s;
        }
    }
}