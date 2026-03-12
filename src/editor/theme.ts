/**
 * SimpleMD Theme Manager
 *
 * Manages theme switching between light, dark, and github themes.
 * Provides both CSS theme application and CodeMirror 6 editor theme extensions.
 */

import { EditorView } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ThemeName =
  | 'light'
  | 'dark'
  | 'github'
  | 'dracula'
  | 'nord'
  | 'solarized-light'
  | 'solarized-dark'
  | 'one-dark'
  | 'monokai';

const STORAGE_KEY = 'simplemd-theme';
const THEME_CLASSES = [
  'theme-light',
  'theme-dark',
  'theme-github',
  'theme-dracula',
  'theme-nord',
  'theme-solarized-light',
  'theme-solarized-dark',
  'theme-one-dark',
  'theme-monokai',
] as const;

// ---------------------------------------------------------------------------
// CSS Imports (bundled by Vite)
// ---------------------------------------------------------------------------

import '../themes/light.css';
import '../themes/dark.css';
import '../themes/github.css';
import '../themes/dracula.css';
import '../themes/nord.css';
import '../themes/solarized-light.css';
import '../themes/solarized-dark.css';
import '../themes/one-dark.css';
import '../themes/monokai.css';

// ---------------------------------------------------------------------------
// CodeMirror Theme Definitions
// ---------------------------------------------------------------------------

/** Light theme — clean, minimal, Typora-inspired */
const cmLightTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#ffffff',
      color: '#333333',
    },
    '.cm-content': {
      caretColor: '#333333',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#333333',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: 'rgba(74, 158, 255, 0.25)',
      },
    '.cm-activeLine': {
      backgroundColor: 'rgba(74, 158, 255, 0.06)',
    },
    '.cm-gutters': {
      backgroundColor: '#fafafa',
      color: '#999999',
      borderRight: '1px solid #e5e5e5',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(74, 158, 255, 0.08)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: '#bbbbbb',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: '#f6f8fa',
      border: '1px solid #e5e5e5',
      color: '#666666',
    },
  },
  { dark: false }
);

const cmLightHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#d73a49' },
  { tag: tags.name, color: '#24292e' },
  { tag: tags.variableName, color: '#e36209' },
  { tag: tags.definition(tags.variableName), color: '#6f42c1' },
  { tag: tags.propertyName, color: '#005cc5' },
  { tag: [tags.string, tags.special(tags.brace)], color: '#032f62' },
  { tag: tags.number, color: '#005cc5' },
  { tag: tags.bool, color: '#005cc5' },
  { tag: tags.null, color: '#005cc5' },
  { tag: tags.comment, color: '#6a737d', fontStyle: 'italic' },
  { tag: tags.typeName, color: '#6f42c1' },
  { tag: tags.className, color: '#6f42c1' },
  { tag: tags.function(tags.variableName), color: '#6f42c1' },
  { tag: tags.operator, color: '#d73a49' },
  { tag: tags.meta, color: '#6a737d' },
  { tag: tags.link, color: '#4a9eff', textDecoration: 'underline' },
  { tag: tags.heading, fontWeight: 'bold', color: '#1a1a1a', textDecoration: 'none' },
  { tag: tags.heading1, fontSize: '2em' },
  { tag: tags.heading2, fontSize: '1.5em' },
  { tag: tags.heading3, fontSize: '1.25em' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, fontFamily: '"SF Mono", "Fira Code", Consolas, monospace' },
  { tag: tags.url, color: '#4a9eff' },
  { tag: tags.processingInstruction, color: '#666666' },
  { tag: tags.quote, color: '#666666' },
]);

/** Dark theme — easy on the eyes */
const cmDarkTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
    },
    '.cm-content': {
      caretColor: '#d4d4d4',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#d4d4d4',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: 'rgba(86, 156, 214, 0.3)',
      },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    '.cm-gutters': {
      backgroundColor: '#252526',
      color: '#666666',
      borderRight: '1px solid #333333',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: '#555555',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: '#2d2d2d',
      border: '1px solid #444444',
      color: '#888888',
    },
  },
  { dark: true }
);

const cmDarkHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#569cd6' },
  { tag: tags.name, color: '#d4d4d4' },
  { tag: tags.variableName, color: '#9cdcfe' },
  { tag: tags.definition(tags.variableName), color: '#4ec9b0' },
  { tag: tags.propertyName, color: '#9cdcfe' },
  { tag: [tags.string, tags.special(tags.brace)], color: '#ce9178' },
  { tag: tags.number, color: '#b5cea8' },
  { tag: tags.bool, color: '#569cd6' },
  { tag: tags.null, color: '#569cd6' },
  { tag: tags.comment, color: '#6a9955', fontStyle: 'italic' },
  { tag: tags.typeName, color: '#4ec9b0' },
  { tag: tags.className, color: '#4ec9b0' },
  { tag: tags.function(tags.variableName), color: '#dcdcaa' },
  { tag: tags.operator, color: '#d4d4d4' },
  { tag: tags.meta, color: '#888888' },
  { tag: tags.link, color: '#569cd6', textDecoration: 'underline' },
  { tag: tags.heading, fontWeight: 'bold', color: '#e0e0e0', textDecoration: 'none' },
  { tag: tags.heading1, fontSize: '2em' },
  { tag: tags.heading2, fontSize: '1.5em' },
  { tag: tags.heading3, fontSize: '1.25em' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, fontFamily: '"SF Mono", "Fira Code", Consolas, monospace' },
  { tag: tags.url, color: '#569cd6' },
  { tag: tags.processingInstruction, color: '#888888' },
  { tag: tags.quote, color: '#999999' },
]);

/** GitHub theme — matches GitHub markdown rendering */
const cmGithubTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#ffffff',
      color: '#24292e',
    },
    '.cm-content': {
      caretColor: '#24292e',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#24292e',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: 'rgba(3, 102, 214, 0.2)',
      },
    '.cm-activeLine': {
      backgroundColor: 'rgba(3, 102, 214, 0.04)',
    },
    '.cm-gutters': {
      backgroundColor: '#f6f8fa',
      color: '#babbbd',
      borderRight: '1px solid #e1e4e8',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(3, 102, 214, 0.06)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: '#babbbd',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: '#f6f8fa',
      border: '1px solid #e1e4e8',
      color: '#586069',
    },
  },
  { dark: false }
);

const cmGithubHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#d73a49' },
  { tag: tags.name, color: '#24292e' },
  { tag: tags.variableName, color: '#e36209' },
  { tag: tags.definition(tags.variableName), color: '#6f42c1' },
  { tag: tags.propertyName, color: '#005cc5' },
  { tag: [tags.string, tags.special(tags.brace)], color: '#032f62' },
  { tag: tags.number, color: '#005cc5' },
  { tag: tags.bool, color: '#005cc5' },
  { tag: tags.null, color: '#005cc5' },
  { tag: tags.comment, color: '#6a737d', fontStyle: 'italic' },
  { tag: tags.typeName, color: '#6f42c1' },
  { tag: tags.className, color: '#6f42c1' },
  { tag: tags.function(tags.variableName), color: '#6f42c1' },
  { tag: tags.operator, color: '#d73a49' },
  { tag: tags.meta, color: '#6a737d' },
  { tag: tags.link, color: '#0366d6', textDecoration: 'underline' },
  { tag: tags.heading, fontWeight: 'bold', color: '#24292e', textDecoration: 'none' },
  { tag: tags.heading1, fontSize: '2em' },
  { tag: tags.heading2, fontSize: '1.5em' },
  { tag: tags.heading3, fontSize: '1.25em' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  {
    tag: tags.monospace,
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  },
  { tag: tags.url, color: '#0366d6' },
  { tag: tags.processingInstruction, color: '#586069' },
  { tag: tags.quote, color: '#6a737d' },
]);

/** Dracula theme */
const cmDraculaTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#282a36',
      color: '#f8f8f2',
    },
    '.cm-content': {
      caretColor: '#f8f8f2',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#f8f8f2',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: 'rgba(68, 71, 90, 0.8)',
      },
    '.cm-activeLine': {
      backgroundColor: 'rgba(68, 71, 90, 0.4)',
    },
    '.cm-gutters': {
      backgroundColor: '#21222c',
      color: '#6272a4',
      borderRight: '1px solid #44475a',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(68, 71, 90, 0.5)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: '#6272a4',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: '#44475a',
      border: '1px solid #6272a4',
      color: '#f8f8f2',
    },
  },
  { dark: true }
);

const cmDraculaHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#ff79c6' },
  { tag: tags.name, color: '#f8f8f2' },
  { tag: tags.variableName, color: '#f8f8f2' },
  { tag: tags.definition(tags.variableName), color: '#50fa7b' },
  { tag: tags.propertyName, color: '#66d9e8' },
  { tag: [tags.string, tags.special(tags.brace)], color: '#f1fa8c' },
  { tag: tags.number, color: '#bd93f9' },
  { tag: tags.bool, color: '#bd93f9' },
  { tag: tags.null, color: '#bd93f9' },
  { tag: tags.comment, color: '#6272a4', fontStyle: 'italic' },
  { tag: tags.typeName, color: '#8be9fd' },
  { tag: tags.className, color: '#8be9fd' },
  { tag: tags.function(tags.variableName), color: '#50fa7b' },
  { tag: tags.operator, color: '#ff79c6' },
  { tag: tags.meta, color: '#6272a4' },
  { tag: tags.link, color: '#8be9fd', textDecoration: 'underline' },
  { tag: tags.heading, fontWeight: 'bold', color: '#f8f8f2', textDecoration: 'none' },
  { tag: tags.heading1, fontSize: '2em' },
  { tag: tags.heading2, fontSize: '1.5em' },
  { tag: tags.heading3, fontSize: '1.25em' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#f1fa8c' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, fontFamily: '"SF Mono", "Fira Code", Consolas, monospace' },
  { tag: tags.url, color: '#8be9fd' },
  { tag: tags.processingInstruction, color: '#6272a4' },
  { tag: tags.quote, color: '#6272a4' },
]);

/** Nord theme */
const cmNordTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#2e3440',
      color: '#d8dee9',
    },
    '.cm-content': {
      caretColor: '#d8dee9',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#d8dee9',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: 'rgba(136, 192, 208, 0.2)',
      },
    '.cm-activeLine': {
      backgroundColor: 'rgba(67, 76, 94, 0.4)',
    },
    '.cm-gutters': {
      backgroundColor: '#272c36',
      color: '#4c566a',
      borderRight: '1px solid #3b4252',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(67, 76, 94, 0.5)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: '#4c566a',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: '#3b4252',
      border: '1px solid #4c566a',
      color: '#d8dee9',
    },
  },
  { dark: true }
);

const cmNordHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#81a1c1' },
  { tag: tags.name, color: '#d8dee9' },
  { tag: tags.variableName, color: '#d8dee9' },
  { tag: tags.definition(tags.variableName), color: '#88c0d0' },
  { tag: tags.propertyName, color: '#8fbcbb' },
  { tag: [tags.string, tags.special(tags.brace)], color: '#a3be8c' },
  { tag: tags.number, color: '#b48ead' },
  { tag: tags.bool, color: '#81a1c1' },
  { tag: tags.null, color: '#81a1c1' },
  { tag: tags.comment, color: '#4c566a', fontStyle: 'italic' },
  { tag: tags.typeName, color: '#8fbcbb' },
  { tag: tags.className, color: '#8fbcbb' },
  { tag: tags.function(tags.variableName), color: '#88c0d0' },
  { tag: tags.operator, color: '#81a1c1' },
  { tag: tags.meta, color: '#4c566a' },
  { tag: tags.link, color: '#88c0d0', textDecoration: 'underline' },
  { tag: tags.heading, fontWeight: 'bold', color: '#eceff4', textDecoration: 'none' },
  { tag: tags.heading1, fontSize: '2em' },
  { tag: tags.heading2, fontSize: '1.5em' },
  { tag: tags.heading3, fontSize: '1.25em' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#ebcb8b' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, fontFamily: '"SF Mono", "Fira Code", Consolas, monospace' },
  { tag: tags.url, color: '#88c0d0' },
  { tag: tags.processingInstruction, color: '#4c566a' },
  { tag: tags.quote, color: '#4c566a' },
]);

/** Solarized Light theme */
const cmSolarizedLightTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#fdf6e3',
      color: '#657b83',
    },
    '.cm-content': {
      caretColor: '#657b83',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#657b83',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: 'rgba(38, 139, 210, 0.18)',
      },
    '.cm-activeLine': {
      backgroundColor: 'rgba(238, 232, 213, 0.5)',
    },
    '.cm-gutters': {
      backgroundColor: '#eee8d5',
      color: '#93a1a1',
      borderRight: '1px solid #ddd6c1',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(238, 232, 213, 0.7)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: '#93a1a1',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: '#eee8d5',
      border: '1px solid #ddd6c1',
      color: '#657b83',
    },
  },
  { dark: false }
);

const cmSolarizedLightHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#859900' },
  { tag: tags.name, color: '#657b83' },
  { tag: tags.variableName, color: '#268bd2' },
  { tag: tags.definition(tags.variableName), color: '#268bd2' },
  { tag: tags.propertyName, color: '#2aa198' },
  { tag: [tags.string, tags.special(tags.brace)], color: '#2aa198' },
  { tag: tags.number, color: '#d33682' },
  { tag: tags.bool, color: '#cb4b16' },
  { tag: tags.null, color: '#cb4b16' },
  { tag: tags.comment, color: '#93a1a1', fontStyle: 'italic' },
  { tag: tags.typeName, color: '#b58900' },
  { tag: tags.className, color: '#b58900' },
  { tag: tags.function(tags.variableName), color: '#268bd2' },
  { tag: tags.operator, color: '#859900' },
  { tag: tags.meta, color: '#93a1a1' },
  { tag: tags.link, color: '#268bd2', textDecoration: 'underline' },
  { tag: tags.heading, fontWeight: 'bold', color: '#073642', textDecoration: 'none' },
  { tag: tags.heading1, fontSize: '2em' },
  { tag: tags.heading2, fontSize: '1.5em' },
  { tag: tags.heading3, fontSize: '1.25em' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#cb4b16' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, fontFamily: '"SF Mono", "Fira Code", Consolas, monospace' },
  { tag: tags.url, color: '#268bd2' },
  { tag: tags.processingInstruction, color: '#93a1a1' },
  { tag: tags.quote, color: '#93a1a1' },
]);

/** Solarized Dark theme */
const cmSolarizedDarkTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#002b36',
      color: '#839496',
    },
    '.cm-content': {
      caretColor: '#839496',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#839496',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: 'rgba(38, 139, 210, 0.25)',
      },
    '.cm-activeLine': {
      backgroundColor: 'rgba(7, 54, 66, 0.5)',
    },
    '.cm-gutters': {
      backgroundColor: '#00212b',
      color: '#586e75',
      borderRight: '1px solid #073642',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(7, 54, 66, 0.7)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: '#586e75',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: '#073642',
      border: '1px solid #586e75',
      color: '#839496',
    },
  },
  { dark: true }
);

const cmSolarizedDarkHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#859900' },
  { tag: tags.name, color: '#839496' },
  { tag: tags.variableName, color: '#268bd2' },
  { tag: tags.definition(tags.variableName), color: '#268bd2' },
  { tag: tags.propertyName, color: '#2aa198' },
  { tag: [tags.string, tags.special(tags.brace)], color: '#2aa198' },
  { tag: tags.number, color: '#d33682' },
  { tag: tags.bool, color: '#cb4b16' },
  { tag: tags.null, color: '#cb4b16' },
  { tag: tags.comment, color: '#586e75', fontStyle: 'italic' },
  { tag: tags.typeName, color: '#b58900' },
  { tag: tags.className, color: '#b58900' },
  { tag: tags.function(tags.variableName), color: '#268bd2' },
  { tag: tags.operator, color: '#859900' },
  { tag: tags.meta, color: '#586e75' },
  { tag: tags.link, color: '#268bd2', textDecoration: 'underline' },
  { tag: tags.heading, fontWeight: 'bold', color: '#93a1a1', textDecoration: 'none' },
  { tag: tags.heading1, fontSize: '2em' },
  { tag: tags.heading2, fontSize: '1.5em' },
  { tag: tags.heading3, fontSize: '1.25em' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#cb4b16' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, fontFamily: '"SF Mono", "Fira Code", Consolas, monospace' },
  { tag: tags.url, color: '#268bd2' },
  { tag: tags.processingInstruction, color: '#586e75' },
  { tag: tags.quote, color: '#586e75' },
]);

/** One Dark theme */
const cmOneDarkTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#282c34',
      color: '#abb2bf',
    },
    '.cm-content': {
      caretColor: '#abb2bf',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#abb2bf',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: 'rgba(97, 175, 239, 0.2)',
      },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    '.cm-gutters': {
      backgroundColor: '#21252b',
      color: '#5c6370',
      borderRight: '1px solid #3e4452',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: '#4b5263',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: '#2c313a',
      border: '1px solid #3e4452',
      color: '#abb2bf',
    },
  },
  { dark: true }
);

const cmOneDarkHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#c678dd' },
  { tag: tags.name, color: '#abb2bf' },
  { tag: tags.variableName, color: '#e06c75' },
  { tag: tags.definition(tags.variableName), color: '#61afef' },
  { tag: tags.propertyName, color: '#56b6c2' },
  { tag: [tags.string, tags.special(tags.brace)], color: '#98c379' },
  { tag: tags.number, color: '#d19a66' },
  { tag: tags.bool, color: '#d19a66' },
  { tag: tags.null, color: '#d19a66' },
  { tag: tags.comment, color: '#5c6370', fontStyle: 'italic' },
  { tag: tags.typeName, color: '#e5c07b' },
  { tag: tags.className, color: '#e5c07b' },
  { tag: tags.function(tags.variableName), color: '#61afef' },
  { tag: tags.operator, color: '#56b6c2' },
  { tag: tags.meta, color: '#5c6370' },
  { tag: tags.link, color: '#61afef', textDecoration: 'underline' },
  { tag: tags.heading, fontWeight: 'bold', color: '#e6efff', textDecoration: 'none' },
  { tag: tags.heading1, fontSize: '2em' },
  { tag: tags.heading2, fontSize: '1.5em' },
  { tag: tags.heading3, fontSize: '1.25em' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#e5c07b' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, fontFamily: '"SF Mono", "Fira Code", Consolas, monospace' },
  { tag: tags.url, color: '#61afef' },
  { tag: tags.processingInstruction, color: '#5c6370' },
  { tag: tags.quote, color: '#5c6370' },
]);

/** Monokai theme */
const cmMonokaiTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#272822',
      color: '#f8f8f2',
    },
    '.cm-content': {
      caretColor: '#f8f8f2',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: '#f8f8f2',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      {
        backgroundColor: 'rgba(73, 72, 62, 0.9)',
      },
    '.cm-activeLine': {
      backgroundColor: 'rgba(62, 61, 50, 0.5)',
    },
    '.cm-gutters': {
      backgroundColor: '#1e1f1a',
      color: '#75715e',
      borderRight: '1px solid #3e3d32',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(62, 61, 50, 0.6)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: '#75715e',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: '#3e3d32',
      border: '1px solid #75715e',
      color: '#f8f8f2',
    },
  },
  { dark: true }
);

const cmMonokaiHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#f92672' },
  { tag: tags.name, color: '#f8f8f2' },
  { tag: tags.variableName, color: '#f8f8f2' },
  { tag: tags.definition(tags.variableName), color: '#a6e22e' },
  { tag: tags.propertyName, color: '#66d9e8' },
  { tag: [tags.string, tags.special(tags.brace)], color: '#e6db74' },
  { tag: tags.number, color: '#ae81ff' },
  { tag: tags.bool, color: '#ae81ff' },
  { tag: tags.null, color: '#ae81ff' },
  { tag: tags.comment, color: '#75715e', fontStyle: 'italic' },
  { tag: tags.typeName, color: '#66d9e8' },
  { tag: tags.className, color: '#a6e22e' },
  { tag: tags.function(tags.variableName), color: '#a6e22e' },
  { tag: tags.operator, color: '#f92672' },
  { tag: tags.meta, color: '#75715e' },
  { tag: tags.link, color: '#66d9e8', textDecoration: 'underline' },
  { tag: tags.heading, fontWeight: 'bold', color: '#f8f8f2', textDecoration: 'none' },
  { tag: tags.heading1, fontSize: '2em' },
  { tag: tags.heading2, fontSize: '1.5em' },
  { tag: tags.heading3, fontSize: '1.25em' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#e6db74' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.monospace, fontFamily: '"SF Mono", "Fira Code", Consolas, monospace' },
  { tag: tags.url, color: '#66d9e8' },
  { tag: tags.processingInstruction, color: '#75715e' },
  { tag: tags.quote, color: '#75715e' },
]);

// ---------------------------------------------------------------------------
// Exported CM6 Extensions (theme + syntax highlighting bundled)
// ---------------------------------------------------------------------------

export const cmThemes: Record<ThemeName, Extension> = {
  light: [cmLightTheme, syntaxHighlighting(cmLightHighlight)],
  dark: [cmDarkTheme, syntaxHighlighting(cmDarkHighlight)],
  github: [cmGithubTheme, syntaxHighlighting(cmGithubHighlight)],
  dracula: [cmDraculaTheme, syntaxHighlighting(cmDraculaHighlight)],
  nord: [cmNordTheme, syntaxHighlighting(cmNordHighlight)],
  'solarized-light': [cmSolarizedLightTheme, syntaxHighlighting(cmSolarizedLightHighlight)],
  'solarized-dark': [cmSolarizedDarkTheme, syntaxHighlighting(cmSolarizedDarkHighlight)],
  'one-dark': [cmOneDarkTheme, syntaxHighlighting(cmOneDarkHighlight)],
  monokai: [cmMonokaiTheme, syntaxHighlighting(cmMonokaiHighlight)],
};

// ---------------------------------------------------------------------------
// Theme Manager
// ---------------------------------------------------------------------------

/**
 * Detect system preferred color scheme.
 */
function detectSystemTheme(): ThemeName {
  return 'github';
}

/**
 * Get the currently saved theme name, or detect from system preference.
 */
function getSavedTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const valid: ThemeName[] = [
      'light', 'dark', 'github', 'dracula', 'nord',
      'solarized-light', 'solarized-dark', 'one-dark', 'monokai',
    ];
    if (saved && (valid as string[]).includes(saved)) {
      return saved as ThemeName;
    }
  } catch {
    // localStorage may be unavailable
  }
  return detectSystemTheme();
}

/** Current active theme name. */
let currentTheme: ThemeName = 'light';

/**
 * Switch the application theme.
 *
 * - Removes all theme classes from `<html>`
 * - Adds `theme-{name}` class
 * - Persists choice to localStorage
 * - Returns the matching CodeMirror extension for the editor
 */
export function setTheme(name: ThemeName): Extension {
  currentTheme = name;

  // Update <html> class
  const root = document.documentElement;
  for (const cls of THEME_CLASSES) {
    root.classList.remove(cls);
  }
  root.classList.add(`theme-${name}`);

  // Persist
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // ignore
  }

  return cmThemes[name];
}

/**
 * Initialize theme on app start.
 * Loads saved preference (or auto-detects) and applies it.
 * Returns the CodeMirror extension for the initial editor setup.
 */
export function initTheme(): Extension {
  const name = getSavedTheme();
  return setTheme(name);
}

/**
 * Get the name of the currently active theme.
 */
export function getCurrentTheme(): ThemeName {
  return currentTheme;
}

/**
 * Cycle to the next theme in order: light -> dark -> github -> light ...
 * Returns the CodeMirror extension for the new theme.
 */
export function cycleTheme(): Extension {
  const order: ThemeName[] = [
    'light', 'dark', 'github', 'dracula', 'nord',
    'solarized-light', 'solarized-dark', 'one-dark', 'monokai',
  ];
  const idx = order.indexOf(currentTheme);
  const next = order[(idx + 1) % order.length];
  return setTheme(next);
}
