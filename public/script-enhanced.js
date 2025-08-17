let editors = {};
let currentEditor = null;
let files = {};
let currentFileId = 'main';
let executionHistory = [];
let debugMode = false;
let splitViewEnabled = false;
let minimapEnabled = false;

const defaultCode = `public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        
        int number = 42;
        System.out.println("The answer is: " + number);
        
        for (int i = 1; i <= 5; i++) {
            System.out.println("Count: " + i);
        }
    }
}`;

require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

require(['vs/editor/editor.main'], function () {
    initializeEditor('main', defaultCode);
    setupEventListeners();
    loadHistoryFromStorage();
    setupKeyboardShortcuts();
    
    // Initial filename update
    setTimeout(() => {
        updateFilenameFromCode('main');
    }, 100);
});

function initializeEditor(fileId, content) {
    const editorContainer = document.getElementById(fileId === 'main' ? 'editor' : 'editor2');
    
    if (editors[fileId]) {
        editors[fileId].dispose();
    }
    
    editors[fileId] = monaco.editor.create(editorContainer, {
        value: content,
        language: 'java',
        theme: 'vs-dark',
        fontSize: 14,
        minimap: { enabled: minimapEnabled },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: 'on',
        lineNumbers: 'on',
        folding: true,
        selectOnLineNumbers: true,
        matchBrackets: 'always',
        autoIndent: 'full',
        formatOnPaste: true,
        formatOnType: true,
        lineHeight: 20,
        padding: { top: 10, bottom: 10 },
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        renderWhitespace: 'selection',
        guides: {
            indentation: true,
            bracketPairs: true
        },
        suggest: {
            snippetsPreventQuickSuggestions: false
        },
        quickSuggestions: {
            other: true,
            comments: false,
            strings: false
        }
    });
    
    files[fileId] = {
        name: fileId === 'main' ? 'Main.java' : `File${Object.keys(files).length + 1}.java`,
        content: content,
        editor: editors[fileId]
    };
    
    currentEditor = editors[fileId];
    currentFileId = fileId;
    
    editors[fileId].onDidChangeModelContent(() => {
        files[fileId].content = editors[fileId].getValue();
        saveToLocalStorage();
        
        // Auto-update filename based on class name
        updateFilenameFromCode(fileId);
    });
    
    setupCodeCompletion(editors[fileId]);
}

function updateFilenameFromCode(fileId) {
    if (!editors[fileId]) return;
    
    const code = editors[fileId].getValue();
    const className = extractClassNameFromCode(code);
    
    if (className && files[fileId]) {
        const newFileName = `${className}.java`;
        if (files[fileId].name !== newFileName) {
            files[fileId].name = newFileName;
            
            // Update the tab title
            const tab = document.querySelector(`[data-file-id="${fileId}"]`);
            if (tab) {
                const tabTitle = tab.querySelector('.tab-title');
                if (tabTitle) {
                    tabTitle.textContent = newFileName;
                    console.log(`Auto-updated filename to: ${newFileName}`);
                }
            }
        }
    }
}

function extractClassNameFromCode(code) {
    // Look for public class declaration
    const publicClassMatch = code.match(/public\s+class\s+(\w+)/);
    if (publicClassMatch) {
        return publicClassMatch[1];
    }
    
    // Look for regular class declaration
    const classMatch = code.match(/class\s+(\w+)/);
    if (classMatch) {
        return classMatch[1];
    }
    
    // Look for enum declaration
    const enumMatch = code.match(/public\s+enum\s+(\w+)/);
    if (enumMatch) {
        return enumMatch[1];
    }
    
    // Look for interface declaration
    const interfaceMatch = code.match(/public\s+interface\s+(\w+)/);
    if (interfaceMatch) {
        return interfaceMatch[1];
    }
    
    return null;
}

function renameCurrentFile() {
    console.log('renameCurrentFile function called');
    
    if (!currentFileId || !files[currentFileId]) {
        showOutput('No active file to rename', 'error');
        return;
    }
    
    const currentFileName = files[currentFileId].name;
    console.log('Current filename:', currentFileName);
    
    const newFileName = prompt('Enter new file name:', currentFileName);
    console.log('New filename entered:', newFileName);
    
    if (newFileName && newFileName.trim() !== '' && newFileName !== currentFileName) {
        let finalFileName = newFileName.trim();
        if (!finalFileName.endsWith('.java')) {
            finalFileName = finalFileName + '.java';
        }
        
        // Update the file object
        files[currentFileId].name = finalFileName;
        
        // Update the tab title
        const tab = document.querySelector(`[data-file-id="${currentFileId}"]`);
        if (tab) {
            const tabTitle = tab.querySelector('.tab-title');
            if (tabTitle) {
                tabTitle.textContent = finalFileName;
            }
        }
        
        // Update the tab data attribute
        if (tab) {
            tab.dataset.fileId = finalFileName.replace('.java', '');
        }
        
        showOutput(`File renamed from "${currentFileName}" to "${finalFileName}"`, 'success');
        console.log(`File renamed: ${currentFileName} → ${finalFileName}`);
        
        // Save to localStorage
        saveToLocalStorage();
    } else {
        console.log('No rename performed - invalid input or same name');
    }
}

function setupCodeCompletion(editor) {
    monaco.languages.registerCompletionItemProvider('java', {
        provideCompletionItems: function(model, position) {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn
            };
            
            const suggestions = [
                {
                    label: 'System.out.println',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'System.out.println(${1:message});',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Print to console',
                    range: range
                },
                {
                    label: 'for',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:length}; ${1:i}++) {\n\t$0\n}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'For loop',
                    range: range
                },
                {
                    label: 'if',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'if (${1:condition}) {\n\t$0\n}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'If statement',
                    range: range
                },
                {
                    label: 'class',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'public class ${1:ClassName} {\n\t$0\n}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Class declaration',
                    range: range
                },
                {
                    label: 'main',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: 'public static void main(String[] args) {\n\t$0\n}',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: 'Main method',
                    range: range
                }
            ];
            
            return { suggestions: suggestions };
        }
    });
}

function setupEventListeners() {
    document.getElementById('runBtn').addEventListener('click', runCode);
    document.getElementById('debugBtn').addEventListener('click', toggleDebugMode);
    document.getElementById('clearBtn').addEventListener('click', clearEditor);
    document.getElementById('clearOutputBtn').addEventListener('click', clearOutput);
    document.getElementById('shareBtn').addEventListener('click', showShareModal);
    document.getElementById('newFileBtn').addEventListener('click', createNewFile);
    document.getElementById('openProjectBtn').addEventListener('click', toggleProjectSidebar);
    document.getElementById('exportOutputBtn').addEventListener('click', exportOutput);
    
    document.getElementById('searchBtn').addEventListener('click', showSearchModal);
    document.getElementById('foldAllBtn').addEventListener('click', foldAll);
    document.getElementById('unfoldAllBtn').addEventListener('click', unfoldAll);
    document.getElementById('formatBtn').addEventListener('click', formatCode);
    
    // Add rename button functionality
    const renameBtn = document.getElementById('renameBtn');
    if (renameBtn) {
        console.log('Rename button found, adding event listener');
        renameBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Rename button clicked!');
            renameCurrentFile();
        });
    } else {
        console.error('Rename button not found!');
    }
    
    document.getElementById('toggleSplitView').addEventListener('click', toggleSplitView);
    document.getElementById('toggleMinimap').addEventListener('click', toggleMinimap);
    document.getElementById('toggleHistory').addEventListener('click', toggleHistoryPanel);
    
    document.getElementById('closeSidebar').addEventListener('click', () => {
        document.getElementById('projectSidebar').style.display = 'none';
    });
    
    document.getElementById('closeHistory').addEventListener('click', () => {
        document.getElementById('historyPanel').style.display = 'none';
    });
    
    document.getElementById('addTabBtn').addEventListener('click', createNewFile);
    document.getElementById('createPackageBtn').addEventListener('click', showPackageModal);
    
    setupOutputTabs();
    setupTabHandlers();
    setupModalHandlers();
    setupThemeSwitcher();
    setupResizer();
    setupFontSizeModal();
    setupHistoryHandlers();
    setupDebugControls();
}

function setupOutputTabs() {
    const outputTabs = document.querySelectorAll('.output-tab');
    outputTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const panel = e.currentTarget.dataset.panel;
            
            document.querySelectorAll('.output-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.output-panel').forEach(p => {
                p.style.display = 'none';
                p.classList.remove('active');
            });
            
            e.currentTarget.classList.add('active');
            const targetPanel = document.getElementById(`${panel}Panel`);
            targetPanel.style.display = 'block';
            targetPanel.classList.add('active');
        });
    });
}

function setupTabHandlers() {
    document.addEventListener('click', (e) => {
        if (e.target.closest('.tab') && !e.target.closest('.tab-close')) {
            const fileId = e.target.closest('.tab').dataset.fileId;
            switchToFile(fileId);
        }
        
        if (e.target.closest('.tab-close')) {
            const fileId = e.target.closest('.tab-close').dataset.fileId;
            closeFile(fileId);
        }
    });
}

function createNewFile() {
    const fileId = `file_${Date.now()}`;
    const fileName = prompt('Enter file name:', `NewClass.java`);
    
    if (!fileName) return;
    
    const newCode = `public class ${fileName.replace('.java', '')} {
    public static void main(String[] args) {
        // Your code here
    }
}`;
    
    const tabsContainer = document.getElementById('tabs');
    const newTab = document.createElement('div');
    newTab.className = 'tab';
    newTab.dataset.fileId = fileId;
    newTab.innerHTML = `
        <span class="tab-title">${fileName}</span>
        <button class="tab-close" data-file-id="${fileId}">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    tabsContainer.appendChild(newTab);
    
    files[fileId] = {
        name: fileName,
        content: newCode
    };
    
    updateFileList();
    switchToFile(fileId);
    saveToLocalStorage();
}

function switchToFile(fileId) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const tab = document.querySelector(`.tab[data-file-id="${fileId}"]`);
    if (tab) {
        tab.classList.add('active');
    }
    
    if (!editors[fileId]) {
        initializeEditor(fileId, files[fileId].content || '');
    } else {
        currentEditor = editors[fileId];
        currentFileId = fileId;
        
        if (splitViewEnabled) {
            document.getElementById('editor').style.display = 'block';
            document.getElementById('editor2').style.display = 'block';
        } else {
            Object.keys(editors).forEach(id => {
                const container = id === 'main' ? 'editor' : 'editor2';
                document.getElementById(container).style.display = id === fileId ? 'block' : 'none';
            });
        }
    }
}

function closeFile(fileId) {
    if (fileId === 'main') {
        alert('Cannot close the main file');
        return;
    }
    
    const tab = document.querySelector(`.tab[data-file-id="${fileId}"]`);
    if (tab) {
        tab.remove();
    }
    
    if (editors[fileId]) {
        editors[fileId].dispose();
        delete editors[fileId];
    }
    
    delete files[fileId];
    
    if (currentFileId === fileId) {
        switchToFile('main');
    }
    
    updateFileList();
    saveToLocalStorage();
}

function renameFile(fileId) {
    const currentName = files[fileId].name;
    const newName = prompt('Enter new file name:', currentName);
    
    if (newName && newName !== currentName) {
        files[fileId].name = newName;
        
        const tab = document.querySelector(`.tab[data-file-id="${fileId}"] .tab-title`);
        if (tab) {
            tab.textContent = newName;
        }
        
        updateFileList();
        saveToLocalStorage();
    }
}

function updateFileList() {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';
    
    Object.keys(files).forEach(fileId => {
        const fileItem = document.createElement('div');
        fileItem.className = 'tree-item';
        fileItem.innerHTML = `
            <i class="fas fa-file-code"></i> 
            <span class="file-name" data-file-id="${fileId}">${files[fileId].name}</span>
            <button class="rename-btn" data-file-id="${fileId}" title="Rename">
                <i class="fas fa-edit"></i>
            </button>
        `;
        fileItem.querySelector('.file-name').onclick = () => switchToFile(fileId);
        fileItem.querySelector('.rename-btn').onclick = (e) => {
            e.stopPropagation();
            renameFile(fileId);
        };
        fileList.appendChild(fileItem);
    });
}

async function runCode() {
    const runBtn = document.getElementById('runBtn');
    const output = document.getElementById('output');
    
    if (!currentEditor) return;
    
    const code = getAllFilesCode();
    
    if (!code.trim()) {
        showOutput('Please enter some Java code to run.', 'error');
        return;
    }
    
    runBtn.disabled = true;
    showOutput('Compiling and running your Java code...', 'info');
    
    const startTime = Date.now();
    
    try {
        const response = await fetch('/api/compile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                code: code,
                files: Object.values(files).map(f => ({
                    name: f.name,
                    content: f.content
                })),
                debug: debugMode
            })
        });
        
        const result = await response.json();
        const executionTime = Date.now() - startTime;
        
        updateExecutionStats(executionTime, result.memoryUsed);
        
        if (result.success) {
            showOutput(result.output || 'Program executed successfully (no output)', 'success');
            addToHistory(code, result.output, 'success', executionTime);
        } else {
            showOutput(result.error || 'Compilation or runtime error occurred', 'error');
            parseAndShowErrors(result.error);
            addToHistory(code, result.error, 'error', executionTime);
        }
    } catch (error) {
        showOutput('Network error: Unable to connect to server', 'error');
        addToHistory(code, error.message, 'error', Date.now() - startTime);
    } finally {
        setTimeout(() => {
            runBtn.disabled = false;
        }, 1500);
    }
}

function getAllFilesCode() {
    if (Object.keys(files).length === 1) {
        return currentEditor.getValue();
    }
    
    let combinedCode = '';
    Object.values(files).forEach(file => {
        combinedCode += `\n// File: ${file.name}\n${file.content}\n`;
    });
    
    return combinedCode;
}

function showOutput(text, type) {
    const output = document.getElementById('output');
    
    if (type === 'error') {
        const highlightedText = highlightSyntax(text, 'error');
        output.innerHTML = highlightedText;
    } else {
        output.textContent = text;
    }
    
    output.className = `output ${type}`;
    
    const placeholder = output.querySelector('.output-placeholder');
    if (placeholder) {
        placeholder.remove();
    }
}

function highlightSyntax(text, type) {
    if (type === 'error') {
        return text.replace(/line (\d+)/gi, '<span class="code-line-highlight" onclick="jumpToLine($1)">line $1</span>')
                   .replace(/at line (\d+)/gi, '<span class="code-line-highlight" onclick="jumpToLine($1)">at line $1</span>')
                   .replace(/\.java:(\d+)/g, '.java:<span class="code-line-highlight" onclick="jumpToLine($1)">$1</span>');
    }
    return text;
}

function jumpToLine(lineNumber) {
    if (currentEditor) {
        currentEditor.revealLineInCenter(lineNumber);
        currentEditor.setPosition({ lineNumber: lineNumber, column: 1 });
        currentEditor.focus();
        
        const decoration = currentEditor.deltaDecorations([], [
            {
                range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                options: {
                    isWholeLine: true,
                    className: 'code-line-highlight',
                    glyphMarginClassName: 'fas fa-exclamation-circle'
                }
            }
        ]);
        
        setTimeout(() => {
            currentEditor.deltaDecorations(decoration, []);
        }, 3000);
    }
}

window.jumpToLine = jumpToLine;

function parseAndShowErrors(errorText) {
    const errorsList = document.getElementById('errorsList');
    errorsList.innerHTML = '';
    
    const lines = errorText.split('\n');
    const errors = [];
    
    lines.forEach(line => {
        const match = line.match(/(.+\.java):(\d+):\s*error:\s*(.+)/);
        if (match) {
            errors.push({
                file: match[1],
                line: parseInt(match[2]),
                message: match[3]
            });
        }
    });
    
    if (errors.length > 0) {
        errors.forEach(error => {
            const errorItem = document.createElement('div');
            errorItem.className = 'error-item error';
            errorItem.innerHTML = `
                <div>${error.message}</div>
                <div class="error-line">${error.file}:${error.line}</div>
            `;
            errorItem.onclick = () => jumpToLine(error.line);
            errorsList.appendChild(errorItem);
        });
        
        document.querySelector('.output-tab[data-panel="errors"]').click();
    }
}

function updateExecutionStats(executionTime, memoryUsed) {
    const stats = document.getElementById('executionStats');
    stats.innerHTML = `
        <i class="fas fa-clock"></i> ${executionTime}ms
        ${memoryUsed ? `| <i class="fas fa-memory"></i> ${(memoryUsed / 1024).toFixed(2)}KB` : ''}
    `;
}

function addToHistory(code, output, status, executionTime) {
    const cleanFiles = {};
    Object.keys(files).forEach(fileId => {
        cleanFiles[fileId] = {
            name: files[fileId].name,
            content: files[fileId].content
        };
    });
    
    const historyItem = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        code: code,
        output: output,
        status: status,
        executionTime: executionTime,
        files: cleanFiles
    };
    
    executionHistory.unshift(historyItem);
    if (executionHistory.length > 50) {
        executionHistory.pop();
    }
    
    updateHistoryDisplay();
    saveHistoryToStorage();
}

function updateHistoryDisplay() {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '';
    
    executionHistory.forEach(item => {
        const historyEl = document.createElement('div');
        historyEl.className = 'history-item';
        historyEl.innerHTML = `
            <div class="history-item-time">${item.timestamp}</div>
            <div class="history-item-status ${item.status}">${item.status === 'success' ? '✓ Success' : '✗ Error'}</div>
            <div style="font-size: 0.8em; color: #666;">${item.executionTime}ms</div>
        `;
        historyEl.onclick = () => loadFromHistory(item);
        historyList.appendChild(historyEl);
    });
}

function loadFromHistory(historyItem) {
    if (confirm('Load this code from history? Current changes will be lost.')) {
        Object.keys(files).forEach(fileId => {
            if (fileId !== 'main') {
                closeFile(fileId);
            }
        });
        
        Object.entries(historyItem.files).forEach(([fileId, file]) => {
            files[fileId] = file;
            if (!editors[fileId]) {
                initializeEditor(fileId, file.content);
            } else {
                editors[fileId].setValue(file.content);
            }
        });
        
        updateFileList();
        switchToFile('main');
    }
}

function setupHistoryHandlers() {
    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
        if (confirm('Clear all execution history?')) {
            executionHistory = [];
            updateHistoryDisplay();
            saveHistoryToStorage();
        }
    });
    
    document.getElementById('compareBtn').addEventListener('click', () => {
        if (executionHistory.length >= 2) {
            compareHistoryItems();
        } else {
            alert('Need at least 2 history items to compare');
        }
    });
}

function compareHistoryItems() {
    const item1 = executionHistory[0];
    const item2 = executionHistory[1];
    
    const diffModal = document.createElement('div');
    diffModal.className = 'modal';
    diffModal.style.display = 'block';
    diffModal.innerHTML = `
        <div class="modal-content" style="width: 80%; max-width: 1200px;">
            <div class="modal-header">
                <h3>Compare Results</h3>
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
            </div>
            <div class="modal-body" style="display: flex; gap: 20px;">
                <div style="flex: 1;">
                    <h4>${item1.timestamp}</h4>
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 10px;">
                        <pre style="margin: 0;">${item1.output}</pre>
                    </div>
                </div>
                <div style="flex: 1;">
                    <h4>${item2.timestamp}</h4>
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 10px;">
                        <pre style="margin: 0;">${item2.output}</pre>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(diffModal);
}

function toggleDebugMode() {
    debugMode = !debugMode;
    const debugBtn = document.getElementById('debugBtn');
    
    if (debugMode) {
        debugBtn.style.background = 'linear-gradient(135deg, #dc3545, #c82333)';
        document.querySelector('.output-tab[data-panel="debug"]').click();
        showDebugOutput('Debug mode enabled. Set breakpoints and run code.');
    } else {
        debugBtn.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)';
        showDebugOutput('Debug mode disabled.');
    }
}

function showDebugOutput(message) {
    const debugOutput = document.getElementById('debugOutput');
    const timestamp = new Date().toLocaleTimeString();
    debugOutput.innerHTML += `<div>[${timestamp}] ${message}</div>`;
    debugOutput.scrollTop = debugOutput.scrollHeight;
}

function setupDebugControls() {
    document.getElementById('stepOverBtn').addEventListener('click', () => {
        showDebugOutput('Step Over executed');
    });
    
    document.getElementById('stepIntoBtn').addEventListener('click', () => {
        showDebugOutput('Step Into executed');
    });
    
    document.getElementById('continueBtn').addEventListener('click', () => {
        showDebugOutput('Continue execution');
    });
}

function toggleSplitView() {
    splitViewEnabled = !splitViewEnabled;
    const editorWrapper = document.querySelector('.editor-wrapper');
    
    if (splitViewEnabled) {
        editorWrapper.style.display = 'flex';
        document.getElementById('editorSection').style.width = '50%';
        document.getElementById('editorSection2').style.display = 'block';
        document.getElementById('editorSection2').style.width = '50%';
        
        if (!editors['file2']) {
            initializeEditor('file2', '// Split view editor');
        }
    } else {
        document.getElementById('editorSection').style.width = '100%';
        document.getElementById('editorSection2').style.display = 'none';
    }
}

function toggleMinimap() {
    minimapEnabled = !minimapEnabled;
    
    Object.values(editors).forEach(editor => {
        editor.updateOptions({ minimap: { enabled: minimapEnabled } });
    });
}

function toggleHistoryPanel() {
    const historyPanel = document.getElementById('historyPanel');
    historyPanel.style.display = historyPanel.style.display === 'none' ? 'flex' : 'none';
}

function toggleProjectSidebar() {
    const sidebar = document.getElementById('projectSidebar');
    sidebar.style.display = sidebar.style.display === 'none' ? 'flex' : 'none';
    updateFileList();
}

function showSearchModal() {
    document.getElementById('searchModal').style.display = 'block';
    document.getElementById('searchInput').focus();
}

function showShareModal() {
    const modal = document.getElementById('shareModal');
    modal.style.display = 'block';
    
    const shareUrl = generateShareUrl();
    document.getElementById('shareUrl').value = shareUrl;
}

function showPackageModal() {
    document.getElementById('packageModal').style.display = 'block';
    
    const packageInput = document.getElementById('packageName');
    const packagePreview = document.getElementById('packagePreview');
    
    packageInput.addEventListener('input', (e) => {
        const packageName = e.target.value;
        if (packageName) {
            const structure = packageName.split('.').join('/');
            packagePreview.innerHTML = `
                <div>Package structure:</div>
                <div>src/${structure}/</div>
            `;
        } else {
            packagePreview.innerHTML = '';
        }
    });
}

function generateShareUrl() {
    const code = currentEditor.getValue();
    const encoded = btoa(encodeURIComponent(code));
    return `${window.location.origin}?code=${encoded}`;
}

function setupModalHandlers() {
    document.getElementById('closeSearchModal').addEventListener('click', () => {
        document.getElementById('searchModal').style.display = 'none';
    });
    
    document.getElementById('closeShareModal').addEventListener('click', () => {
        document.getElementById('shareModal').style.display = 'none';
    });
    
    document.getElementById('closePackageModal').addEventListener('click', () => {
        document.getElementById('packageModal').style.display = 'none';
    });
    
    document.getElementById('findNextBtn').addEventListener('click', findNext);
    document.getElementById('findPrevBtn').addEventListener('click', findPrevious);
    document.getElementById('replaceBtn').addEventListener('click', replace);
    document.getElementById('replaceAllBtn').addEventListener('click', replaceAll);
    
    document.getElementById('copyUrlBtn').addEventListener('click', () => {
        const shareUrl = document.getElementById('shareUrl');
        shareUrl.select();
        document.execCommand('copy');
        alert('URL copied to clipboard!');
    });
    
    document.getElementById('shareTwitter').addEventListener('click', () => {
        const url = document.getElementById('shareUrl').value;
        window.open(`https://twitter.com/intent/tweet?text=Check out my Java code!&url=${encodeURIComponent(url)}`, '_blank');
    });
    
    document.getElementById('shareLinkedIn').addEventListener('click', () => {
        const url = document.getElementById('shareUrl').value;
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
    });
    
    document.getElementById('createPackageConfirm').addEventListener('click', () => {
        const packageName = document.getElementById('packageName').value;
        if (packageName) {
            createPackageStructure(packageName);
            document.getElementById('packageModal').style.display = 'none';
        }
    });
}

function createPackageStructure(packageName) {
    const className = packageName.split('.').pop();
    const capitalizedClassName = className.charAt(0).toUpperCase() + className.slice(1);
    
    const newCode = `package ${packageName};

public class ${capitalizedClassName} {
    public static void main(String[] args) {
        System.out.println("Package: ${packageName}");
    }
}`;
    
    createNewFileWithContent(`${capitalizedClassName}.java`, newCode);
}

function createNewFileWithContent(fileName, content) {
    const fileId = `file_${Date.now()}`;
    
    const tabsContainer = document.getElementById('tabs');
    const newTab = document.createElement('div');
    newTab.className = 'tab';
    newTab.dataset.fileId = fileId;
    newTab.innerHTML = `
        <span class="tab-title">${fileName}</span>
        <button class="tab-close" data-file-id="${fileId}">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    tabsContainer.appendChild(newTab);
    
    files[fileId] = {
        name: fileName,
        content: content
    };
    
    updateFileList();
    switchToFile(fileId);
    
    if (!editors[fileId]) {
        initializeEditor(fileId, content);
    }
}

let searchState = {
    searchString: '',
    replaceString: '',
    isRegex: false,
    isCaseSensitive: false,
    matches: []
};

function findNext() {
    const searchInput = document.getElementById('searchInput').value;
    const isRegex = document.getElementById('searchRegex').checked;
    const isCaseSensitive = document.getElementById('searchCase').checked;
    
    if (!searchInput || !currentEditor) return;
    
    const model = currentEditor.getModel();
    const searchOptions = {
        regex: isRegex,
        matchCase: isCaseSensitive,
        wordSeparators: null
    };
    
    const matches = model.findMatches(searchInput, true, isRegex, isCaseSensitive, null, true);
    
    if (matches.length > 0) {
        currentEditor.setSelection(matches[0].range);
        currentEditor.revealRangeInCenter(matches[0].range);
    }
}

function findPrevious() {
    findNext();
}

function replace() {
    const replaceInput = document.getElementById('replaceInput').value;
    
    if (!currentEditor) return;
    
    const selection = currentEditor.getSelection();
    if (!selection.isEmpty()) {
        currentEditor.executeEdits('replace', [{
            range: selection,
            text: replaceInput
        }]);
    }
    
    findNext();
}

function replaceAll() {
    const searchInput = document.getElementById('searchInput').value;
    const replaceInput = document.getElementById('replaceInput').value;
    const isRegex = document.getElementById('searchRegex').checked;
    const isCaseSensitive = document.getElementById('searchCase').checked;
    
    if (!searchInput || !currentEditor) return;
    
    const model = currentEditor.getModel();
    const matches = model.findMatches(searchInput, true, isRegex, isCaseSensitive, null, true);
    
    const edits = matches.map(match => ({
        range: match.range,
        text: replaceInput
    }));
    
    currentEditor.executeEdits('replaceAll', edits);
}

function foldAll() {
    if (currentEditor) {
        currentEditor.getAction('editor.foldAll').run();
    }
}

function unfoldAll() {
    if (currentEditor) {
        currentEditor.getAction('editor.unfoldAll').run();
    }
}

function formatCode() {
    if (currentEditor) {
        currentEditor.getAction('editor.action.formatDocument').run();
    }
}

function exportOutput() {
    const output = document.getElementById('output').textContent;
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `output_${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function clearEditor() {
    if (currentEditor) {
        currentEditor.setValue(defaultCode);
        currentEditor.focus();
    }
}

function clearOutput() {
    const output = document.getElementById('output');
    output.innerHTML = '<div class="output-placeholder">Run your Java code to see output here...</div>';
    output.className = 'output';
    
    document.getElementById('errorsList').innerHTML = '';
    document.getElementById('debugOutput').innerHTML = '';
    document.getElementById('executionStats').innerHTML = '';
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            runCode();
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            showSearchModal();
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveToLocalStorage();
        }
        
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
            e.preventDefault();
            formatCode();
        }
        
        // F2 key for rename
        if (e.key === 'F2') {
            e.preventDefault();
            renameCurrentFile();
        }
    });
}

function setupThemeSwitcher() {
    const themeDropdownItems = document.querySelectorAll('.dropdown-item[data-theme]');
    
    themeDropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const theme = e.target.dataset.theme;
            if (monaco && monaco.editor) {
                monaco.editor.setTheme(theme);
            }
            localStorage.setItem('editorTheme', theme);
        });
    });
    
    const savedTheme = localStorage.getItem('editorTheme');
    if (savedTheme && monaco && monaco.editor) {
        monaco.editor.setTheme(savedTheme);
    }
}

function setupResizer() {
    const resizer = document.getElementById('resizer');
    const editorContainer = document.getElementById('editorContainer');
    const outputContainer = document.querySelector('.output-container');
    const mainContent = document.querySelector('.main-content');
    
    let isResizing = false;
    
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
        e.preventDefault();
    });
    
    function handleResize(e) {
        if (!isResizing) return;
        
        const containerRect = mainContent.getBoundingClientRect();
        const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        
        if (newLeftWidth > 20 && newLeftWidth < 80) {
            editorContainer.style.flex = `0 0 ${newLeftWidth}%`;
            outputContainer.style.flex = `0 0 ${100 - newLeftWidth}%`;
        }
    }
    
    function stopResize() {
        isResizing = false;
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
    }
}

function setupFontSizeModal() {
    const modal = document.getElementById('fontSizeModal');
    const closeModal = document.getElementById('closeModal');
    const dropdownItems = document.querySelectorAll('.dropdown-item[data-target]');
    const fontSizeOptions = document.querySelectorAll('.font-size-option');
    const fontAppliedMessage = document.getElementById('fontAppliedMessage');
    const modalTitle = document.getElementById('modalTitle');
    
    let currentTarget = '';
    
    dropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
            currentTarget = e.target.dataset.target;
            modalTitle.textContent = `Select Font Size for ${currentTarget === 'editor' ? 'Code Editor' : 'Output'}`;
            modal.style.display = 'block';
            fontAppliedMessage.style.display = 'none';
        });
    });
    
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    fontSizeOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            const fontSize = e.target.dataset.size;
            
            fontSizeOptions.forEach(opt => opt.classList.remove('selected'));
            e.target.classList.add('selected');
            
            if (currentTarget === 'editor') {
                Object.values(editors).forEach(editor => {
                    editor.updateOptions({ fontSize: parseInt(fontSize) });
                });
                localStorage.setItem('editorFontSize', fontSize);
            } else if (currentTarget === 'output') {
                const outputElement = document.getElementById('output');
                outputElement.style.fontSize = fontSize + 'px';
                localStorage.setItem('outputFontSize', fontSize);
            }
            
            fontAppliedMessage.style.display = 'block';
            
            setTimeout(() => {
                modal.style.display = 'none';
                fontAppliedMessage.style.display = 'none';
                fontSizeOptions.forEach(opt => opt.classList.remove('selected'));
            }, 1500);
        });
    });
}

function saveToLocalStorage() {
    const cleanFiles = {};
    Object.keys(files).forEach(fileId => {
        cleanFiles[fileId] = {
            name: files[fileId].name,
            content: files[fileId].content
        };
    });
    
    const data = {
        files: cleanFiles,
        currentFileId: currentFileId,
        fontSize: currentEditor ? currentEditor.getOptions().get(monaco.editor.EditorOption.fontSize) : 14
    };
    
    localStorage.setItem('javaCompilerData', JSON.stringify(data));
}

function loadFromLocalStorage() {
    const data = localStorage.getItem('javaCompilerData');
    
    if (data) {
        try {
            const parsed = JSON.parse(data);
            
            if (parsed.files) {
                files = parsed.files;
                updateFileList();
            }
            
            if (parsed.currentFileId && files[parsed.currentFileId]) {
                switchToFile(parsed.currentFileId);
            }
            
            if (parsed.fontSize) {
                Object.values(editors).forEach(editor => {
                    editor.updateOptions({ fontSize: parsed.fontSize });
                });
            }
        } catch (e) {
            console.error('Error loading saved data:', e);
        }
    }
}

function saveHistoryToStorage() {
    localStorage.setItem('executionHistory', JSON.stringify(executionHistory));
}

function loadHistoryFromStorage() {
    const history = localStorage.getItem('executionHistory');
    
    if (history) {
        try {
            executionHistory = JSON.parse(history);
            updateHistoryDisplay();
        } catch (e) {
            console.error('Error loading history:', e);
        }
    }
}

window.addEventListener('beforeunload', () => {
    saveToLocalStorage();
    saveHistoryToStorage();
});

const urlParams = new URLSearchParams(window.location.search);
const sharedCode = urlParams.get('code');

if (sharedCode) {
    try {
        const decodedCode = decodeURIComponent(atob(sharedCode));
        setTimeout(() => {
            if (currentEditor) {
                currentEditor.setValue(decodedCode);
            }
        }, 1000);
    } catch (e) {
        console.error('Error loading shared code:', e);
    }
}
