import blessed from 'blessed';
import chalk from 'chalk';
import { realTimeMonitor } from './real-time-monitor.js';

export class TerminalUI {
  constructor() {
    this.screen = null;
    this.boxes = {};
    this.eventBuffer = [];
    this.maxEvents = 100;
    this.currentFilter = null;
    this.highlightPattern = null;
  }

  initialize() {
    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Claude Flow - Real-Time Monitor',
      fullUnicode: true
    });

    // Create layout
    this.createLayout();

    // Set up event handlers
    this.setupEventHandlers();

    // Start updating
    this.startUpdating();

    // Render
    this.screen.render();
  }

  createLayout() {
    // Title box
    this.boxes.title = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        }
      },
      content: '{center}🐝 Claude Flow Real-Time Monitor{/center}\n{center}Press q to quit | f for filters | h for help{/center}'
    });

    // Metrics box
    this.boxes.metrics = blessed.box({
      top: 3,
      left: 0,
      width: '30%',
      height: '40%',
      label: ' Metrics ',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'green'
        }
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true
    });

    // Events log
    this.boxes.events = blessed.log({
      top: 3,
      left: '30%',
      width: '70%',
      height: '60%',
      label: ' Events ',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'blue'
        }
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true
    });

    // Agent status box
    this.boxes.agents = blessed.box({
      top: '43%',
      left: 0,
      width: '30%',
      height: '40%',
      label: ' Active Agents ',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'yellow'
        }
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true
    });

    // Summary box
    this.boxes.summary = blessed.box({
      bottom: 0,
      left: '30%',
      width: '70%',
      height: '37%',
      label: ' Summary ',
      tags: true,
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'magenta'
        }
      },
      scrollable: true,
      alwaysScroll: true,
      mouse: true
    });

    // Add all boxes to screen
    Object.values(this.boxes).forEach(box => {
      this.screen.append(box);
    });

    // Filter dialog (hidden by default)
    this.filterDialog = blessed.form({
      parent: this.screen,
      keys: true,
      left: 'center',
      top: 'center',
      width: '50%',
      height: '50%',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'white'
        }
      },
      hidden: true,
      label: ' Filters '
    });

    // Add filter inputs
    blessed.text({
      parent: this.filterDialog,
      left: 2,
      top: 1,
      content: 'Category:'
    });

    this.filterCategory = blessed.textbox({
      parent: this.filterDialog,
      name: 'category',
      left: 12,
      top: 1,
      width: 20,
      height: 1,
      border: {
        type: 'line'
      },
      style: {
        focus: {
          border: {
            fg: 'cyan'
          }
        }
      }
    });

    blessed.text({
      parent: this.filterDialog,
      left: 2,
      top: 3,
      content: 'Type:'
    });

    this.filterType = blessed.textbox({
      parent: this.filterDialog,
      name: 'type',
      left: 12,
      top: 3,
      width: 20,
      height: 1,
      border: {
        type: 'line'
      },
      style: {
        focus: {
          border: {
            fg: 'cyan'
          }
        }
      }
    });

    blessed.text({
      parent: this.filterDialog,
      left: 2,
      top: 5,
      content: 'Pattern:'
    });

    this.filterPattern = blessed.textbox({
      parent: this.filterDialog,
      name: 'pattern',
      left: 12,
      top: 5,
      width: 20,
      height: 1,
      border: {
        type: 'line'
      },
      style: {
        focus: {
          border: {
            fg: 'cyan'
          }
        }
      }
    });

    const applyButton = blessed.button({
      parent: this.filterDialog,
      mouse: true,
      keys: true,
      shrink: true,
      padding: {
        left: 1,
        right: 1
      },
      left: 2,
      bottom: 2,
      content: 'Apply',
      style: {
        focus: {
          bg: 'blue'
        },
        hover: {
          bg: 'blue'
        }
      }
    });

    const clearButton = blessed.button({
      parent: this.filterDialog,
      mouse: true,
      keys: true,
      shrink: true,
      padding: {
        left: 1,
        right: 1
      },
      left: 10,
      bottom: 2,
      content: 'Clear',
      style: {
        focus: {
          bg: 'red'
        },
        hover: {
          bg: 'red'
        }
      }
    });

    const cancelButton = blessed.button({
      parent: this.filterDialog,
      mouse: true,
      keys: true,
      shrink: true,
      padding: {
        left: 1,
        right: 1
      },
      right: 2,
      bottom: 2,
      content: 'Cancel',
      style: {
        focus: {
          bg: 'yellow'
        },
        hover: {
          bg: 'yellow'
        }
      }
    });

    // Button handlers
    applyButton.on('press', () => {
      this.currentFilter = {
        category: this.filterCategory.getValue(),
        type: this.filterType.getValue(),
        pattern: this.filterPattern.getValue()
      };
      this.filterDialog.hide();
      this.screen.render();
    });

    clearButton.on('press', () => {
      this.currentFilter = null;
      this.filterCategory.setValue('');
      this.filterType.setValue('');
      this.filterPattern.setValue('');
      this.filterDialog.hide();
      this.screen.render();
    });

    cancelButton.on('press', () => {
      this.filterDialog.hide();
      this.screen.render();
    });
  }

  setupEventHandlers() {
    // Quit
    this.screen.key(['q', 'C-c'], () => {
      process.exit(0);
    });

    // Show filter dialog
    this.screen.key('f', () => {
      this.filterDialog.show();
      this.filterDialog.focus();
      this.screen.render();
    });

    // Help
    this.screen.key('h', () => {
      const helpBox = blessed.message({
        parent: this.screen,
        left: 'center',
        top: 'center',
        width: '50%',
        height: '50%',
        border: {
          type: 'line'
        },
        style: {
          border: {
            fg: 'white'
          }
        },
        label: ' Help '
      });

      helpBox.display(
        'Keyboard Shortcuts:\n\n' +
        'q - Quit\n' +
        'f - Open filters\n' +
        'h - Show this help\n' +
        'c - Clear events\n' +
        'r - Reset metrics\n' +
        'Tab - Focus next box\n' +
        'Shift+Tab - Focus previous box\n\n' +
        'Mouse:\n' +
        'Click and drag to scroll\n' +
        'Wheel to scroll',
        0,
        () => {
          this.screen.render();
        }
      );
    });

    // Clear events
    this.screen.key('c', () => {
      this.eventBuffer = [];
      this.boxes.events.setContent('');
      realTimeMonitor.clear();
      this.screen.render();
    });

    // Reset metrics
    this.screen.key('r', () => {
      realTimeMonitor.clear();
      this.screen.render();
    });

    // Tab navigation
    this.screen.key('tab', () => {
      this.screen.focusNext();
    });

    this.screen.key('S-tab', () => {
      this.screen.focusPrevious();
    });

    // Listen to real-time monitor events
    realTimeMonitor.on('event', (event) => {
      this.addEvent(event);
    });
  }

  addEvent(event) {
    // Apply filters
    if (this.currentFilter) {
      if (this.currentFilter.category && event.category !== this.currentFilter.category) return;
      if (this.currentFilter.type && event.type !== this.currentFilter.type) return;
      if (this.currentFilter.pattern) {
        const regex = new RegExp(this.currentFilter.pattern, 'i');
        if (!regex.test(JSON.stringify(event))) return;
      }
    }

    // Add to buffer
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > this.maxEvents) {
      this.eventBuffer.shift();
    }

    // Format event
    const levelColors = {
      error: 'red',
      warning: 'yellow',
      success: 'green',
      info: 'blue'
    };

    const color = levelColors[event.level] || 'white';
    const time = new Date(event.timestamp).toLocaleTimeString();
    const message = `{${color}-fg}[${time}] ${event.category}/${event.type}{/} ${JSON.stringify(event.data)}`;

    // Add to log
    this.boxes.events.log(message);
  }

  startUpdating() {
    setInterval(() => {
      this.updateMetrics();
      this.updateAgents();
      this.updateSummary();
      this.screen.render();
    }, 1000);
  }

  updateMetrics() {
    const metrics = realTimeMonitor.getMetrics();
    
    const content = [
      `{green-fg}Events/sec:{/} ${metrics.eventsPerSecond.toFixed(2)}`,
      `{blue-fg}Active Agents:{/} ${metrics.activeAgents}`,
      `{green-fg}Completed Tasks:{/} ${metrics.completedTasks}`,
      `{red-fg}Failed Tasks:{/} ${metrics.failedTasks}`,
      `{yellow-fg}Avg Response:{/} ${metrics.avgResponseTime.toFixed(2)}ms`,
      '',
      `{cyan-fg}Memory Usage:{/} ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
      `{magenta-fg}CPU Usage:{/} ${metrics.cpuUsage.toFixed(2)}%`,
      '',
      `{white-fg}Total Events:{/} ${metrics.totalEvents}`
    ];

    if (this.currentFilter) {
      content.push('');
      content.push('{yellow-fg}Filter Active{/}');
    }

    this.boxes.metrics.setContent(content.join('\n'));
  }

  updateAgents() {
    // This would be populated with actual agent data
    const content = [
      '{green-fg}● researcher-1{/} - Analyzing data',
      '{green-fg}● coder-2{/} - Writing functions',
      '{yellow-fg}● tester-3{/} - Running tests',
      '{blue-fg}● coordinator-4{/} - Managing tasks'
    ];

    this.boxes.agents.setContent(content.join('\n'));
  }

  updateSummary() {
    const metrics = realTimeMonitor.getMetrics();
    const eventCounts = metrics.eventCounts || {};
    
    // Sort event counts
    const sortedCounts = Object.entries(eventCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    const content = [
      '{cyan-fg}Top Event Types:{/}',
      ...sortedCounts.map(([key, count]) => `  ${key}: ${count}`),
      '',
      '{yellow-fg}Event Distribution:{/}'
    ];

    // Add event distribution
    const categories = {};
    Object.keys(eventCounts).forEach(key => {
      const category = key.split('.')[0];
      categories[category] = (categories[category] || 0) + eventCounts[key];
    });

    Object.entries(categories).forEach(([cat, count]) => {
      const percentage = (count / metrics.totalEvents * 100).toFixed(1);
      const barLength = Math.floor(percentage / 5);
      const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
      content.push(`  ${cat}: ${bar} ${percentage}%`);
    });

    this.boxes.summary.setContent(content.join('\n'));
  }
}

// CLI command handler
export function startTerminalUI(options = {}) {
  const ui = new TerminalUI();
  
  // Initialize real-time monitor
  realTimeMonitor.initialize(options.port || 3333);
  
  // Start terminal UI
  ui.initialize();
  
  // Apply initial filters if provided
  if (options.filter) {
    ui.currentFilter = options.filter;
  }
  
  if (options.highlight) {
    ui.highlightPattern = options.highlight;
  }
  
  return ui;
}