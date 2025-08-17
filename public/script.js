let editor;

require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

require(['vs/editor/editor.main'], function () {
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

    editor = monaco.editor.create(document.getElementById('editor'), {
        value: defaultCode,
        language: 'java',
        theme: 'vs-dark',
        fontSize: 14,
        minimap: { enabled: false },
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
        }
    });

    // Add content change listener for automatic filename detection
    editor.onDidChangeModelContent(() => {
        updateFilenameFromCode();
    });

    setupEventListeners();
    
    // Initial filename update
    updateFilenameFromCode();
});

function setupEventListeners() {
    const runBtn = document.getElementById('runBtn');
    const clearBtn = document.getElementById('clearBtn');
    const clearOutputBtn = document.getElementById('clearOutputBtn');
    const testAnimationBtn = document.getElementById('testAnimationBtn');
    const renameBtn = document.getElementById('renameBtn');
    const output = document.getElementById('output');

    // Add event listeners with error handling
    if (runBtn) runBtn.addEventListener('click', runCode);
    if (clearBtn) clearBtn.addEventListener('click', clearEditor);
    if (clearOutputBtn) clearOutputBtn.addEventListener('click', clearOutput);
    if (testAnimationBtn) testAnimationBtn.addEventListener('click', testAnimation);
    
    // Fix rename button event listener
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
    
    // Add test rename button
    const testRenameBtn = document.getElementById('testRenameBtn');
    if (testRenameBtn) {
        console.log('Test rename button found, adding event listener');
        testRenameBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Test rename button clicked!');
            showOutput('Testing rename functionality...', 'info');
            setTimeout(() => {
                renameCurrentFile();
            }, 500);
        });
    } else {
        console.error('Test rename button not found!');
    }
    
    setupThemeSwitcher();

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            runCode();
        }
        
        if (e.key === 'F2') {
            e.preventDefault();
            renameCurrentFile();
        }
    });

    setupResizer();
    setupFontSizeModal();
}

async function runCode() {
    const runBtn = document.getElementById('runBtn');
    const output = document.getElementById('output');
    
    if (!editor) return;
    
    const code = editor.getValue().trim();
    
    if (!code) {
        showOutput('Please enter some Java code to run.', 'error');
        return;
    }

    runBtn.disabled = true;
    console.log('Button disabled:', runBtn.disabled);
    showOutput('Compiling and running your Java code...', 'info');

    const startTime = Date.now();
    const minAnimationTime = 1500;

    try {
        const response = await fetch('/api/compile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code })
        });

        const result = await response.json();

        if (result.success) {
            showOutput(result.output || 'Program executed successfully (no output)', 'success');
        } else {
            showOutput(result.error || 'Compilation or runtime error occurred', 'error');
        }
    } catch (error) {
        console.error('Network error:', error);
        showOutput('Network error: Unable to connect to server. Make sure you are accessing the app through http://localhost:3000', 'error');
    } finally {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minAnimationTime - elapsedTime);
        
        setTimeout(() => {
            runBtn.disabled = false;
            console.log('Button re-enabled:', runBtn.disabled);
        }, remainingTime);
    }
}

function showOutput(text, type) {
    const output = document.getElementById('output');
    output.textContent = text;
    output.className = `output ${type}`;
    
    if (output.querySelector('.output-placeholder')) {
        output.querySelector('.output-placeholder').remove();
    }
}

function clearEditor() {
    if (editor) {
        const defaultCode = `public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`;
        editor.setValue(defaultCode);
        editor.focus();
        
        // Update filename after clearing
        setTimeout(() => {
            updateFilenameFromCode();
        }, 100);
    }
}

function clearOutput() {
    const output = document.getElementById('output');
    output.innerHTML = '<div class="output-placeholder">Run your Java code to see output here...</div>';
    output.className = 'output';
}

function testAnimation() {
    const runBtn = document.getElementById('runBtn');
    console.log('Testing animation...');
    console.log('Button disabled state before:', runBtn.disabled);
    
    runBtn.disabled = true;
    console.log('Button disabled state after:', runBtn.disabled);
    
    setTimeout(() => {
        runBtn.disabled = false;
        console.log('Button re-enabled');
    }, 3000);
}

function updateFilenameFromCode() {
    if (!editor) return;
    
    const code = editor.getValue();
    const className = extractClassNameFromCode(code);
    
    if (className) {
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            const tabTitle = activeTab.querySelector('.tab-title');
            if (tabTitle) {
                const newFileName = `${className}.java`;
                if (tabTitle.textContent !== newFileName) {
                    tabTitle.textContent = newFileName;
                    activeTab.dataset.fileId = className;
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
    
    const activeTab = document.querySelector('.tab.active');
    console.log('Active tab found:', activeTab);
    
    if (!activeTab) {
        showOutput('No active file to rename', 'error');
        return;
    }
    
    const tabTitle = activeTab.querySelector('.tab-title');
    console.log('Tab title element found:', tabTitle);
    
    if (!tabTitle) {
        showOutput('Could not find tab title element', 'error');
        return;
    }
    
    const currentFileName = tabTitle.textContent;
    console.log('Current filename:', currentFileName);
    
    const newFileName = prompt('Enter new file name:', currentFileName);
    console.log('New filename entered:', newFileName);
    
    if (newFileName && newFileName.trim() !== '' && newFileName !== currentFileName) {
        let finalFileName = newFileName.trim();
        if (!finalFileName.endsWith('.java')) {
            finalFileName = finalFileName + '.java';
        }
        
        tabTitle.textContent = finalFileName;
        activeTab.dataset.fileId = finalFileName.replace('.java', '');
        
        showOutput(`File renamed from "${currentFileName}" to "${finalFileName}"`, 'success');
        
        console.log(`File renamed: ${currentFileName} → ${finalFileName}`);
    } else {
        console.log('No rename performed - invalid input or same name');
    }
}

function setupResizer() {
    const resizer = document.getElementById('resizer');
    const editorSection = document.getElementById('editorSection');
    const outputSection = document.getElementById('outputSection');
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
            editorSection.style.flex = `0 0 ${newLeftWidth}%`;
            outputSection.style.flex = `0 0 ${100 - newLeftWidth}%`;
        }
    }

    function stopResize() {
        isResizing = false;
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
    }
}

function setupThemeSwitcher() {
    const themeDropdownItems = document.querySelectorAll('.dropdown-item[data-theme]');
    
    themeDropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const theme = e.target.dataset.theme;
            if (editor) {
                monaco.editor.setTheme(theme);
                console.log('Theme changed to:', theme);
                
                const themeName = e.target.textContent;
                showThemeChangeMessage(themeName);
            }
        });
    });
}

function showThemeChangeMessage(themeName) {
    const output = document.getElementById('output');
    const currentContent = output.innerHTML;
    
    const message = `<div style="color: #28a745; font-style: italic; margin-bottom: 10px;">Theme changed to: ${themeName}</div>`;
    output.innerHTML = message + currentContent;
    
    setTimeout(() => {
        if (output.querySelector('div')) {
            output.querySelector('div').remove();
        }
    }, 2000);
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
            
            if (currentTarget === 'editor' && editor) {
                editor.updateOptions({ fontSize: parseInt(fontSize) });
            } else if (currentTarget === 'output') {
                const outputElement = document.getElementById('output');
                outputElement.style.fontSize = fontSize + 'px';
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