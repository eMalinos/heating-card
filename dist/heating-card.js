/**
 * heating-card — one heating circuit for Home Assistant, in the Homecraft look.
 * Box 1: the circuit (flame circle + outdoor temperature, status message, mode, program / off-schedule panel).
 * Box 2: the valves (tiles with an icon circle by phase, state line, − target +).
 * Tapping a valve opens its dialog (batteries, windows, 24 h chart, calibrate).
 * It reads only the entities the ha-features-builder `heating` feature publishes.
 * https://github.com/eMalinos/heating-card
 */

const VERSION = '0.1.0-beta.5';

const GESTURES = ['tap', 'double_tap', 'hold', 'icon_tap', 'icon_double_tap', 'icon_hold', 'none'];
const HOLD_MS = 500;
const DOUBLE_MS = 250;
const STEP = 0.5;

// MDI paths (@mdi/js 7.4.47), copied so the card has no dependency.
const ICON = {
  fire: 'M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2M14.5 17.5C14.22 17.74 13.76 18 13.4 18.1C12.28 18.5 11.16 17.94 10.5 17.28C11.69 17 12.4 16.12 12.61 15.23C12.78 14.43 12.46 13.77 12.33 13C12.21 12.26 12.23 11.63 12.5 10.94C12.69 11.32 12.89 11.7 13.13 12C13.9 13 15.11 13.44 15.37 14.8C15.41 14.94 15.43 15.08 15.43 15.23C15.46 16.05 15.1 16.95 14.5 17.5H14.5Z',
  pipe: 'M22 13V21H20V19H16.58C15.81 20.76 14.05 22 12 22S8.19 20.76 7.42 19H4V21H2V13H4V15H7.43C7.93 13.85 8.85 12.93 10 12.42V11H8V9H16V11H14V12.42C15.15 12.93 16.07 13.85 16.57 15H20V13H22M17 2H7C6.45 2 6 2.45 6 3S6.45 4 7 4H10V5H11V8H13V5H14V4H17C17.55 4 18 3.55 18 3S17.55 2 17 2Z',
  closed: 'M22 2V22H20V13H14.82A3 3 0 0 1 9.18 13H4V22H2V2H4V11H9.18A3 3 0 0 1 14.82 11H20V2Z',
  window: 'M21 20V2H3V20H1V23H23V20M19 4V11H17V4M5 4H7V11H5M5 20V13H7V20M9 20V4H15V20M17 20V13H19V20Z',
  battery: 'M14 20H6V6H14M14.67 4H13V2H7V4H5.33C4.6 4 4 4.6 4 5.33V20.67C4 21.4 4.6 22 5.33 22H14.67C15.4 22 16 21.4 16 20.67V5.33C16 4.6 15.4 4 14.67 4M21 7H19V13H21V8M21 15H19V17H21V15Z',
  calendarWeek: 'M6 1H8V3H16V1H18V3H19C20.11 3 21 3.9 21 5V19C21 20.11 20.11 21 19 21H5C3.89 21 3 20.1 3 19V5C3 3.89 3.89 3 5 3H6V1M5 8V19H19V8H5M7 10H17V12H7V10Z',
  calendarStar: 'M19 19H5V8H19M16 1V3H8V1H6V3H5C3.9 3 3 3.9 3 5V19C3 20.11 3.9 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.9 20.11 3 19 3H18V1M10.88 12H7.27L10.19 14.11L9.08 17.56L12 15.43L14.92 17.56L13.8 14.12L16.72 12H13.12L12 8.56L10.88 12Z',
  homeOutline: 'M12 5.69L17 10.19V18H15V12H9V18H7V10.19L12 5.69M12 3L2 12H5V20H11V14H13V20H19V12H22',
  laptop: 'M4,6H20V16H4M20,18A2,2 0 0,0 22,16V6C22,4.89 21.1,4 20,4H4C2.89,4 2,4.89 2,6V16A2,2 0 0,0 4,18H0V20H24V18H20Z',
  beach: 'M15,18.54C17.13,18.21 19.5,18 22,18V22H5C5,21.35 8.2,19.86 13,18.9V12.4C12.16,12.65 11.45,13.21 11,13.95C10.39,12.93 9.27,12.25 8,12.25C6.73,12.25 5.61,12.93 5,13.95C5.03,10.37 8.5,7.43 13,7.04V7A1,1 0 0,1 14,6A1,1 0 0,1 15,7V7.04C19.5,7.43 22.96,10.37 23,13.95C22.39,12.93 21.27,12.25 20,12.25C18.73,12.25 17.61,12.93 17,13.95C16.55,13.21 15.84,12.65 15,12.39V18.54M7,2A5,5 0 0,1 2,7V2H7Z',
  sick: 'M7.32 10.56L8.38 9.5L7.32 8.44L8.38 7.38L10.5 9.5L8.38 11.62L7.32 10.56M4.5 9C4.53 9 4.55 9 4.58 9C5.77 6.07 8.64 4 12 4C14.19 4 16.16 4.88 17.61 6.3C17.76 5.7 18.06 5 18.42 4.34C16.68 2.88 14.44 2 12 2C7.11 2 3.05 5.5 2.18 10.14C2.74 9.44 3.59 9 4.5 9M21 10.5C20.58 10.5 20.18 10.41 19.81 10.28C19.93 10.83 20 11.41 20 12C20 16.42 16.42 20 12 20C8.64 20 5.77 17.93 4.58 15C4.55 15 4.53 15 4.5 15C4 15 3.46 14.86 3 14.6C2.68 14.42 2.41 14.18 2.18 13.9C3.07 18.5 7.11 22 12 22C17.5 22 22 17.5 22 12C22 11.45 21.94 10.91 21.86 10.38C21.58 10.45 21.3 10.5 21 10.5M21 3C21 3 19 5.9 19 7S19.9 9 21 9 23 8.1 23 7 21 3 21 3M15.62 7.38L13.5 9.5L15.62 11.62L16.68 10.56L15.62 9.5L16.68 8.44L15.62 7.38M8.56 17C9.25 15.81 10.53 15 12 15S14.75 15.81 15.44 17H17.12C16.32 14.95 14.33 13.5 12 13.5C11.13 13.5 10.3 13.7 9.57 14.07L6 12C6 11.5 5.73 11 5.25 10.71C4.53 10.3 3.62 10.54 3.2 11.26C2.79 12 3.03 12.89 3.75 13.31C4.23 13.59 4.8 13.56 5.24 13.31L8.21 15.03C7.64 15.56 7.18 16.24 6.88 17H8.56Z',
  check: 'M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z',
  sync: 'M12,18A6,6 0 0,1 6,12C6,11 6.25,10.03 6.7,9.2L5.24,7.74C4.46,8.97 4,10.43 4,12A8,8 0 0,0 12,20V23L16,19L12,15M12,4V1L8,5L12,9V6A6,6 0 0,1 18,12C18,13 17.75,13.97 17.3,14.8L18.76,16.26C19.54,15.03 20,13.57 20,12A8,8 0 0,0 12,4Z',
  pencil: 'M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z',
  cog: 'M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z',
  thermoLow: 'M15 13V5A3 3 0 0 0 9 5V13A5 5 0 1 0 15 13M12 4A1 1 0 0 1 13 5V12H11V5A1 1 0 0 1 12 4Z',
  cloudOutline: 'M12.74,5.47C15.1,6.5 16.35,9.03 15.92,11.46C17.19,12.56 18,14.19 18,16V16.17C18.31,16.06 18.65,16 19,16A3,3 0 0,1 22,19A3,3 0 0,1 19,22H6A4,4 0 0,1 2,18A4,4 0 0,1 6,14H6.27C5,12.45 4.6,10.24 5.5,8.26C6.72,5.5 9.97,4.24 12.74,5.47M11.93,7.3C10.16,6.5 8.09,7.31 7.31,9.07C6.85,10.09 6.93,11.22 7.41,12.13C8.5,10.83 10.16,10 12,10C12.7,10 13.38,10.12 14,10.34C13.94,9.06 13.18,7.86 11.93,7.3M13.55,3.64C13,3.4 12.45,3.23 11.88,3.12L14.37,1.82L15.27,4.71C14.76,4.29 14.19,3.93 13.55,3.64M6.09,4.44C5.6,4.79 5.17,5.19 4.8,5.63L4.91,2.82L7.87,3.5C7.25,3.71 6.65,4.03 6.09,4.44M18,9.71C17.91,9.12 17.78,8.55 17.59,8L19.97,9.5L17.92,11.73C18.03,11.08 18.05,10.4 18,9.71M3.04,11.3C3.11,11.9 3.24,12.47 3.43,13L1.06,11.5L3.1,9.28C3,9.93 2.97,10.61 3.04,11.3M19,18H16V16A4,4 0 0,0 12,12A4,4 0 0,0 8,16H6A2,2 0 0,0 4,18A2,2 0 0,0 6,20H19A1,1 0 0,0 20,19A1,1 0 0,0 19,18Z',
  chevron: 'M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z',
  clockStart: 'M12,1C8.14,1 5,4.14 5,8A7,7 0 0,0 12,15C15.86,15 19,11.87 19,8C19,4.14 15.86,1 12,1M12,3.15C14.67,3.15 16.85,5.32 16.85,8C16.85,10.68 14.67,12.85 12,12.85A4.85,4.85 0 0,1 7.15,8A4.85,4.85 0 0,1 12,3.15M11,5V8.69L14.19,10.53L14.94,9.23L12.5,7.82V5M4,16V24H6V21H18V24L22,20L18,16V19H6V16',
  clockEnd: 'M12,1C8.14,1 5,4.14 5,8A7,7 0 0,0 12,15C15.86,15 19,11.87 19,8C19,4.14 15.86,1 12,1M12,3.15C14.67,3.15 16.85,5.32 16.85,8C16.85,10.68 14.67,12.85 12,12.85A4.85,4.85 0 0,1 7.15,8A4.85,4.85 0 0,1 12,3.15M11,5V8.69L14.19,10.53L14.94,9.23L12.5,7.82V5M15,16V19H3V21H15V24L19,20M19,20V24H21V16H19',
  rocket: 'M13.13 22.19L11.5 18.36C13.07 17.78 14.54 17 15.9 16.09L13.13 22.19M5.64 12.5L1.81 10.87L7.91 8.1C7 9.46 6.22 10.93 5.64 12.5M19.22 4C19.5 4 19.75 4 19.96 4.05C20.13 5.44 19.94 8.3 16.66 11.58C14.96 13.29 12.93 14.6 10.65 15.47L8.5 13.37C9.42 11.06 10.73 9.03 12.42 7.34C15.18 4.58 17.64 4 19.22 4M19.22 2C17.24 2 14.24 2.69 11 5.93C8.81 8.12 7.5 10.53 6.65 12.64C6.37 13.39 6.56 14.21 7.11 14.77L9.24 16.89C9.62 17.27 10.13 17.5 10.66 17.5C10.89 17.5 11.13 17.44 11.36 17.35C13.5 16.53 15.88 15.19 18.07 13C23.73 7.34 21.61 2.39 21.61 2.39S20.7 2 19.22 2M14.54 9.46C13.76 8.68 13.76 7.41 14.54 6.63S16.59 5.85 17.37 6.63C18.14 7.41 18.15 8.68 17.37 9.46C16.59 10.24 15.32 10.24 14.54 9.46M8.88 16.53L7.47 15.12L8.88 16.53M6.24 22L9.88 18.36C9.54 18.27 9.21 18.12 8.91 17.91L4.83 22H6.24M2 22H3.41L8.18 17.24L6.76 15.83L2 20.59V22M2 19.17L6.09 15.09C5.88 14.79 5.73 14.47 5.64 14.12L2 17.76V19.17Z',
  valve: 'M4 22H2V2H4M22 2H20V22H22M17.24 5.34L13.24 9.34A3 3 0 0 0 9.24 13.34L5.24 17.34L6.66 18.76L10.66 14.76A3 3 0 0 0 14.66 10.76L18.66 6.76Z',
  thermoUp: 'M17.41 11.83L20.58 15L22 13.59L17.41 9L12.82 13.59L14.24 15L17.41 11.83M10 13V5C10 3.34 8.66 2 7 2S4 3.34 4 5V13C1.79 14.66 1.34 17.79 3 20S7.79 22.66 10 21 12.66 16.21 11 14C10.72 13.62 10.38 13.28 10 13M7 4C7.55 4 8 4.45 8 5V8H6V5C6 4.45 6.45 4 7 4Z',
  pump: 'M2 21V15H3.5C3.18 14.06 3 13.05 3 12C3 7.03 7.03 3 12 3H22V9H20.5C20.82 9.94 21 10.95 21 12C21 16.97 16.97 21 12 21H2M5 12C5 13.28 5.34 14.47 5.94 15.5L9.4 13.5C9.15 13.06 9 12.55 9 12C9 11.35 9.21 10.75 9.56 10.26L6.3 7.93C5.5 9.08 5 10.5 5 12M12 19C14.59 19 16.85 17.59 18.06 15.5L14.6 13.5C14.08 14.4 13.11 15 12 15L11.71 15L11.33 18.97L12 19M12 9C13.21 9 14.26 9.72 14.73 10.76L18.37 9.1C17.27 6.68 14.83 5 12 5V9M12 11C11.45 11 11 11.45 11 12C11 12.55 11.45 13 12 13C12.55 13 13 12.55 13 12C13 11.45 12.55 11 12 11Z',
  timerSand: 'M18 22H6V16L10 12L6 8V2H18V8L14 12L18 16M8 7.5L12 11.5L16 7.5V4H8M12 12.5L8 16.5V20H16V16.5M14 18H10V17.2L12 15.2L14 17.2Z',
  bellRing: 'M10,21H14A2,2 0 0,1 12,23A2,2 0 0,1 10,21M21,19V20H3V19L5,17V11C5,7.9 7.03,5.17 10,4.29C10,4.19 10,4.1 10,4A2,2 0 0,1 12,2A2,2 0 0,1 14,4C14,4.1 14,4.19 14,4.29C16.97,5.17 19,7.9 19,11V17L21,19M17,11A5,5 0 0,0 12,6A5,5 0 0,0 7,11V18H17V11M19.75,3.19L18.33,4.61C20.04,6.3 21,8.6 21,11H23C23,8.07 21.84,5.25 19.75,3.19M1,11H3C3,8.6 3.96,6.3 5.67,4.61L4.25,3.19C2.16,5.25 1,8.07 1,11Z',
  radiator: 'M7.95,3L6.53,5.19L7.95,7.4H7.94L5.95,10.5L4.22,9.6L5.64,7.39L4.22,5.19L6.22,2.09L7.95,3M13.95,2.89L12.53,5.1L13.95,7.3L13.94,7.31L11.95,10.4L10.22,9.5L11.64,7.3L10.22,5.1L12.22,2L13.95,2.89M20,2.89L18.56,5.1L20,7.3V7.31L18,10.4L16.25,9.5L17.67,7.3L16.25,5.1L18.25,2L20,2.89M2,22V14A2,2 0 0,1 4,12H20A2,2 0 0,1 22,14V22H20V20H4V22H2M6,14A1,1 0 0,0 5,15V17A1,1 0 0,0 6,18A1,1 0 0,0 7,17V15A1,1 0 0,0 6,14M10,14A1,1 0 0,0 9,15V17A1,1 0 0,0 10,18A1,1 0 0,0 11,17V15A1,1 0 0,0 10,14M14,14A1,1 0 0,0 13,15V17A1,1 0 0,0 14,18A1,1 0 0,0 15,17V15A1,1 0 0,0 14,14M18,14A1,1 0 0,0 17,15V17A1,1 0 0,0 18,18A1,1 0 0,0 19,17V15A1,1 0 0,0 18,14Z',
  batteryLow: 'M16 20H8V6H16M16.67 4H15V2H9V4H7.33C6.6 4 6 4.6 6 5.33V20.67C6 21.4 6.6 22 7.33 22H16.67C17.41 22 18 21.41 18 20.67V5.33C18 4.6 17.4 4 16.67 4M15 16H9V19H15V16',
  message: 'M20,2A2,2 0 0,1 22,4V16A2,2 0 0,1 20,18H6L2,22V4C2,2.89 2.9,2 4,2H20M4,4V17.17L5.17,16H20V4H4M6,7H18V9H6V7M6,11H15V13H6V11Z',
  bellOutline: 'M10 21H14C14 22.1 13.1 23 12 23S10 22.1 10 21M21 19V20H3V19L5 17V11C5 7.9 7 5.2 10 4.3V4C10 2.9 10.9 2 12 2S14 2.9 14 4V4.3C17 5.2 19 7.9 19 11V17L21 19M17 11C17 8.2 14.8 6 12 6S7 8.2 7 11V18H17V11Z',
  clock: 'M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z',
  thermometer: 'M15 13V5A3 3 0 0 0 9 5V13A5 5 0 1 0 15 13M12 4A1 1 0 0 1 13 5V8H11V5A1 1 0 0 1 12 4Z',
  tune: 'M8 13C6.14 13 4.59 14.28 4.14 16H2V18H4.14C4.59 19.72 6.14 21 8 21S11.41 19.72 11.86 18H22V16H11.86C11.41 14.28 9.86 13 8 13M8 19C6.9 19 6 18.1 6 17C6 15.9 6.9 15 8 15S10 15.9 10 17C10 18.1 9.1 19 8 19M19.86 6C19.41 4.28 17.86 3 16 3S12.59 4.28 12.14 6H2V8H12.14C12.59 9.72 14.14 11 16 11S19.41 9.72 19.86 8H22V6H19.86M16 9C14.9 9 14 8.1 14 7C14 5.9 14.9 5 16 5S18 5.9 18 7C18 8.1 17.1 9 16 9Z',
  relay: 'M1,11H3.17C3.58,9.83 4.69,9 6,9C6.65,9 7.25,9.21 7.74,9.56L14.44,4.87L15.58,6.5L8.89,11.2C8.96,11.45 9,11.72 9,12A3,3 0 0,1 6,15C4.69,15 3.58,14.17 3.17,13H1V11M23,11V13H20.83C20.42,14.17 19.31,15 18,15A3,3 0 0,1 15,12A3,3 0 0,1 18,9C19.31,9 20.42,9.83 20.83,11H23M6,11A1,1 0 0,0 5,12A1,1 0 0,0 6,13A1,1 0 0,0 7,12A1,1 0 0,0 6,11M18,11A1,1 0 0,0 17,12A1,1 0 0,0 18,13A1,1 0 0,0 19,12A1,1 0 0,0 18,11Z',
};

// Texts as in library/heating/src/heating_texts.jinja (ui.valve_*, ui.hero_*).
const T = {
  phase: { heat: 'Topí', fast: 'Rychlý start', run: 'Doběh', closed: 'Zavřeno', idle: 'Nečinný', window: 'Okno otevřené', off: 'Vypnuto' },
  source: { valve: 'hlavice', window: 'okno', other: 'čidlo' },
  // ui.program_* of heating_texts.jinja, capitalised
  program: { auto: 'Výchozí', vacation: 'Dovolená' },
};
const BAD = ['', 'unknown', 'unavailable', undefined, null];

export const fmt = (n, d = 0) => Number(n).toLocaleString('cs-CZ', { minimumFractionDigits: d, maximumFractionDigits: d });

// Czech plural: 1 / 2-4 / 5+ and 0.
export const pluralWord = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);
export const plural = (n, one, few, many) => `${n} ${pluralWord(n, one, few, many)}`;

const num = (v) => { const x = Number.parseFloat(v); return Number.isFinite(x) ? x : null; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function normalizeConfig(config) {
  if (!config?.circuit || typeof config.circuit !== 'string') throw new Error('heating-card: circuit is required');
  const valves = config.valves;
  if (!Array.isArray(valves) || !valves.length) throw new Error('heating-card: valves must be a non-empty list of climate entities');
  const bad = valves.find((v) => typeof v !== 'string' || !v.startsWith('climate.'));
  if (bad !== undefined) throw new Error(`heating-card: valves must be climate.* entities (got ${bad})`);
  const schedule = config.schedule_gesture ?? 'tap';
  const info = config.info_gesture ?? 'icon_tap';
  for (const [k, g] of [['schedule_gesture', schedule], ['info_gesture', info]]) {
    if (!GESTURES.includes(g)) throw new Error(`heating-card: ${k} must be one of ${GESTURES.join(', ')}`);
  }
  if (schedule === info && schedule !== 'none') throw new Error('heating-card: schedule_gesture and info_gesture must differ');
  // condensing_boiler: false hides the settings dialog's Kotel tab; anything but `false` keeps it
  return { circuit: config.circuit, valves: [...valves], heading: config.heading || '', schedule_gesture: schedule, info_gesture: info, condensing_boiler: config.condensing_boiler !== false };
}

const st = (hass, id) => hass.states?.[id]?.state;
const at = (hass, id, k) => hass.states?.[id]?.attributes?.[k];

// The `<domain>.<name>_<circuit>` entity id.
const eid = (cfg, domain, name) => `${domain}.${name}_${cfg.circuit}`;

// "hlavice 14 %", "okno balkon 8 %": window rows with a name (or entity id) name the window.
const winLabel = (name) => (/^okno(\s|$)/i.test(name) ? name : `Okno ${name}`);
export function batteryText(b) {
  const name = b.name || b.entity_id?.split('.')[1];
  const label = b.source === 'window' && name ? winLabel(name).toLowerCase() : T.source[b.source] ?? T.source.other;
  return `${label} ${b.state} %`;
}

// One valve tile: phase (window > off > fast > run > closed > heat > idle), state line, battery rows.
export function valveView(hass, cfg, climate) {
  const attrs = hass.states?.[climate]?.attributes ?? {};
  const windowOpen = (at(hass, eid(cfg, 'sensor', 'heating_off_schedule'), 'window_open_climates') ?? []).includes(climate);
  // the circuit counts as running only when the sensor says exactly `on`; unavailable / missing = unknown
  const activeSt = st(hass, eid(cfg, 'binary_sensor', 'heating_active'));
  const active = activeSt === 'on';
  const raw = at(hass, eid(cfg, 'sensor', 'heating_valves'), 'phases')?.[climate]?.[0] ?? 'normal';
  const inDemand = (at(hass, eid(cfg, 'sensor', 'heating_valves'), 'demand') ?? []).includes(climate);
  const phase = windowOpen ? 'window' : !active ? 'off'
    : raw === 'fast' ? 'fast' : raw === 'run' || raw === 'overrun' ? 'run' : raw === 'closed' ? 'closed' : inDemand ? 'heat' : 'idle';
  const now = num(attrs.current_temperature);
  const lowBattery = (at(hass, eid(cfg, 'sensor', 'heating_low_batteries'), 'low_battery') ?? [])
    .filter((r) => r.climate === climate).map((r) => ({ source: r.source, state: r.state }));
  const word = phase === 'off' && activeSt !== 'off' && st(hass, eid(cfg, 'input_select', 'heating_mode')) !== 'off' ? 'Stav neznámý' : T.phase[phase];
  let state = word + (now == null ? '' : ` · ${fmt(now, 1)} °C`);
  if (lowBattery.length === 1) state = `Baterie ${lowBattery[0].state} %`;
  else if (lowBattery.length > 1) {
    const rows = lowBattery.map((b) => batteryText({ source: b.source, state: b.state })).join(' · ');
    state = rows.charAt(0).toUpperCase() + rows.slice(1);
  }
  return {
    climate, name: attrs.friendly_name || climate.split('.')[1], phase, word, state, now, target: num(attrs.temperature),
    min: num(attrs.min_temp) ?? 5, max: num(attrs.max_temp) ?? 30,
    off: phase === 'window' || phase === 'off', lowBattery,
  };
}

// The circuit's title: the configured heading, the area title the feature publishes, else the circuit id.
const circuitTitle = (hass, cfg) => cfg.heading || at(hass, eid(cfg, 'binary_sensor', 'heating_state'), 'title') || cfg.circuit;

// sensor.heating_applying_<c>: Node-RED is setting the valves (trigger program / sync), `left` valves to go.
const applyingState = (hass, cfg) => {
  const ap = eid(cfg, 'sensor', 'heating_applying');
  return { on: st(hass, ap) === 'applying', trigger: at(hass, ap, 'trigger'), left: num(at(hass, ap, 'left')) ?? 0 };
};

// Box 1: header subtitle, mode + hint, status, program, off-schedule count, applying, outdoor value.
export function circuitView(hass, cfg) {
  const e = (d, n) => eid(cfg, d, n);
  const mode = st(hass, e('input_select', 'heating_mode'));
  const boilerOn = st(hass, e('switch', 'boiler')) === 'on';
  const demandList = at(hass, e('sensor', 'heating_valves'), 'demand') ?? [];
  const demand = cfg.valves.filter((v) => demandList.includes(v)).length;
  const left = num(at(hass, e('sensor', 'heating_valves'), 'left')) ?? 0;
  const demandText = demand === 0 ? 'žádná hlavice netopí' : `${plural(demand, 'hlavice chce', 'hlavice chtějí', 'hlavic chce')} teplo`;
  const activeSt = st(hass, e('binary_sensor', 'heating_active'));
  const subtitle = mode === 'off' ? 'Vypnuto · hlavice na 5 °C'
    : activeSt !== 'on' && activeSt !== 'off' ? 'Stav neznámý'
    : boilerOn ? `Kotel topí · ${demandText}`
      : left > 0 ? `Kotel netopí · doběh čerpadla, ještě ${left} min` : 'Kotel netopí';

  let hint = '';
  if (mode === 'on') hint = 'podle rozvrhu';
  else if (mode === 'off') hint = 'hlavice na 5 °C';
  else if (mode === 'by_weather') {
    if (st(hass, e('input_select', 'heating_auto_rule')) === 'time') {
      const f = String(st(hass, e('input_datetime', 'heating_time_from')) ?? '').slice(0, 5);
      const t = String(st(hass, e('input_datetime', 'heating_time_to')) ?? '').slice(0, 5);
      hint = /^\d\d:\d\d$/.test(f) && /^\d\d:\d\d$/.test(t) ? `${f}–${t} každý den` : 'nastav čas od–do';
    } else {
      const x = num(st(hass, e('input_number', 'heating_weather_threshold'))) ?? 0;
      hint = `pod ${fmt(x, Number.isInteger(x) ? 0 : 1)} °C venku`;
    }
  }

  // input_text.heating_status: "level|text", level success / warning / error, anything else is info
  const rawStatus = st(hass, e('input_text', 'heating_status')) ?? '';
  const m = /^(success|warning|error|info)\|([\s\S]*)$/.exec(rawStatus);
  const text = (m ? m[2] : rawStatus).trim();
  const status = text && !['unknown', 'unavailable'].includes(text) ? { level: m ? m[1] : 'info', text } : null;

  const programName = programLabel(hass, cfg, programId(hass, cfg));
  return {
    title: circuitTitle(hass, cfg),
    boilerOn, subtitle, demand, mode, hint, status, programName,
    offSchedule: num(st(hass, e('sensor', 'heating_off_schedule'))) ?? 0,
    applying: applyingState(hass, cfg),
    outdoor: num(st(hass, e('sensor', 'heating_outdoor_temperature'))),
  };
}

// Box 2 header: `N topí · N okno · N baterie` (zero okno / baterie are left out).
export function valvesSummary(views) {
  const heat = views.filter((v) => v.phase === 'heat' || v.phase === 'fast').length;
  const win = views.filter((v) => v.phase === 'window').length;
  const bat = views.filter((v) => v.lowBattery.length).length;
  return [`${heat} topí`, win && plural(win, 'okno', 'okna', 'oken'), bat && plural(bat, 'baterie', 'baterie', 'baterií')].filter(Boolean).join(' · ');
}

// ---- Valve dialog (design V4-Valve / V4-ValveWindow) ----

// Entities of the valve's device (hass.entities maps entity id -> {device_id}).
export function deviceEntities(hass, climate) {
  const d = hass.entities?.[climate]?.device_id;
  return d ? Object.keys(hass.entities).filter((id) => hass.entities[id].device_id === d) : [];
}

const DEFAULT_LOW_BATTERY = 30;

// Everything the valve dialog shows. Pure; `now` (ms) only for the minutes a window has been open.
// The valve's window sensors as published by the heating feature (#439).
export const windowList = (hass, cfg, climate) => at(hass, eid(cfg, 'sensor', 'heating_off_schedule'), 'windows')?.[climate] ?? [];
const sinceMs = (w) => { const t = Date.parse(w.since); return Number.isFinite(t) ? t : null; };

// `ids` = the valve's device entities (deviceEntities), cached by the card while its dialog is open.
export function valveDetail(hass, cfg, climate, now = Date.now(), ids = deviceEntities(hass, climate)) {
  const v = valveView(hass, cfg, climate);
  const cls = (id) => hass.states?.[id]?.attributes?.device_class;
  const numeric = (id) => num(hass.states?.[id]?.state);
  const find = (re) => ids.find((id) => re.test(id) && numeric(id) != null);
  const threshold = num(st(hass, 'input_number.heating_low_battery_threshold')) ?? DEFAULT_LOW_BATTERY;
  const batId = ids.find((id) => id.startsWith('sensor.') && cls(id) === 'battery' && numeric(id) != null);
  const sigId = ids.find((id) => id.startsWith('sensor.') && cls(id) === 'signal_strength' && numeric(id) != null);
  const posId = find(/^sensor\..*_valve_position$/);
  const calId = ids.find((id) => /^binary_sensor\..*_calibration$/.test(id) && !BAD.includes(st(hass, id)));
  const batValue = batId ? numeric(batId) : null;
  const position = posId ? numeric(posId) : null;

  const windows = windowList(hass, cfg, climate).map((w) => {
    const kind = w.open === true || w.state === 'on' ? 'open' : w.state === 'off' ? 'closed' : 'unavailable';
    const since = sinceMs(w);
    const minutes = kind === 'open' && since != null ? Math.max(0, Math.floor((now - since) / 60000)) : null; // unknown `since`: no minutes
    const battery = w.battery ? num(st(hass, w.battery)) : null;
    return {
      id: w.entity_id, name: w.name || w.entity_id, kind, minutes, battery, lowBattery: battery != null && battery < threshold,
      state: kind === 'open' ? (minutes == null ? 'Otevřené' : `Otevřené · ${minutes} min`) : kind === 'closed' ? 'Zavřené' : 'Čidlo nedostupné',
    };
  });
  const open = windows.filter((w) => w.kind === 'open').sort((a, b) => (b.minutes ?? -1) - (a.minutes ?? -1));

  // the one alert: the open window first, else every low battery of this valve
  let alert = null;
  if (open.length || v.phase === 'window') {
    const w = open[0];
    const reminder = num(st(hass, eid(cfg, 'input_number', 'heating_window_reminder'))) ?? 0;
    const left = w?.minutes != null ? reminder - w.minutes : 0;
    alert = {
      kind: 'window',
      title: w ? `${winLabel(w.name)} otevřené${w.minutes == null ? '' : ` ${w.minutes} min`}` : 'Okno otevřené',
      text: ` · hlavice netopí, dokud se okno nezavře.${reminder > 0 && left > 0 ? ` Připomenu za ${left} min.` : ''}`,
    };
  } else if (v.lowBattery.length) {
    const low = (at(hass, eid(cfg, 'sensor', 'heating_low_batteries'), 'list_low') ?? []).filter((b) => b.climates?.includes(climate));
    const items = low.length
      ? low.map(batteryText)
      : v.lowBattery.map((b) => batteryText({ source: b.source, state: b.state }));
    alert = { kind: 'battery', title: `Vyměň baterie (${items.length})`, text: ` · ${items.join(', ')}` };
  }
  return {
    view: v, title: cfg.heading || at(hass, eid(cfg, 'binary_sensor', 'heating_state'), 'title') || cfg.circuit,
    alert, windows, position, signal: sigId ? numeric(sigId) : null,
    calibration: calId ? st(hass, calId) === 'on' ? 'needed' : 'ok' : null,
    battery: batValue == null ? null : { value: batValue, low: batValue < threshold },
  };
}

// 24 h chart geometry. rows = history/history_during_period rows of the climate ({a: attributes, lu: epoch s}),
// winRows = rows of every window sensor ({s: state, lu}). Returns SVG path data + open-window spans in x units, or null without data.
export const CHART = { w: 440, top: 10, bottom: 114 };
const ts = (r) => { const t = r.lu ?? r.lc; return typeof t === 'number' ? t * 1000 : Date.parse(t); };
// wins = [{rows, since}]: a window's history rows ({s, lu}) and, for an open window, when it opened (`since`).
export function chartModel(rows, wins, end, hours = 24) {
  const start = end - hours * 3600000;
  const x = (t) => Math.round(((Math.min(end, Math.max(start, t)) - start) / (end - start)) * CHART.w * 10) / 10;
  let cur = null, tgt = null;
  const pts = (rows ?? []).map((r) => {
    cur = num(r.a?.current_temperature) ?? cur;
    tgt = num(r.a?.temperature) ?? tgt;
    return { t: ts(r), cur, tgt };
  }).filter((p) => Number.isFinite(p.t));
  const vals = pts.flatMap((p) => [p.cur, p.tgt]).filter((n) => n != null);
  if (!vals.length) return null;
  const lo = Math.floor(Math.min(...vals) - 0.5), hi = Math.ceil(Math.max(...vals) + 0.5);
  const y = (n) => Math.round((CHART.bottom - ((n - lo) / (hi - lo)) * (CHART.bottom - CHART.top)) * 10) / 10;
  const line = (key, step) => {
    let d = '', prev = null;
    for (const p of pts) {
      if (p[key] == null) continue;
      d += d === '' ? `M${x(p.t)} ${y(p[key])}` : step ? ` H${x(p.t)} V${y(p[key])}` : ` L${x(p.t)} ${y(p[key])}`;
      prev = p;
    }
    return prev ? d + (step ? ` H${CHART.w}` : ` L${CHART.w} ${y(prev[key])}`) : ''; // the last value holds until now
  };
  // open spans: merge the windows' "on" intervals (a state holds until the next row)
  const spans = [];
  for (const { rows: rs, since } of wins ?? []) {
    const sorted = (rs ?? []).map((r) => ({ t: ts(r), on: r.s === 'on' })).filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
    const mine = [];
    sorted.forEach((p, i) => { if (p.on) mine.push([p.t, sorted[i + 1]?.t ?? end]); });
    // an open window opened at `since`: the history's first row (the start state) is only the chart start
    if (since != null) { if (mine.length && mine.at(-1)[1] === end) mine.at(-1)[0] = Math.max(mine.at(-1)[0], since); else mine.push([since, end]); }
    spans.push(...mine);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const s of spans) {
    if (s[1] <= start) continue;
    if (merged.length && s[0] <= merged.at(-1)[1]) merged.at(-1)[1] = Math.max(merged.at(-1)[1], s[1]);
    else merged.push([...s]);
  }
  const labels = [];
  for (let t = Math.ceil(start / 3600000) * 3600000; t <= end; t += 3600000) {
    const h = new Date(t).getHours();
    if (h % 6 === 0) labels.push({ x: x(t), text: `${h}:00` });
  }
  return { current: line('cur', false), target: line('tgt', true), bands: merged.map(([a, b]) => ({ x: x(a), w: Math.max(2, Math.round((x(b) - x(a)) * 10) / 10) })), labels };
}

// Gesture zones of a tile from the config: {body: {tap, double_tap, hold}, icon: {...}} -> 'schedule' | 'info'.
// An icon without its own gesture falls back to the body's.
export function gestureMap(cfg) {
  const zones = { body: {}, icon: {} };
  for (const [action, g] of [['schedule', cfg.schedule_gesture], ['info', cfg.info_gesture]]) {
    if (g === 'none') continue;
    zones[g.startsWith('icon_') ? 'icon' : 'body'][g.replace('icon_', '')] = action;
  }
  return zones;
}

// What a gesture does in a zone; the icon circle falls back to the body per gesture.
export const zoneHandlers = (zones, zone) => (zone === 'icon' ? { ...zones.body, ...zones.icon } : zones.body);

// A pending ± target is dropped once hass reports it or after 5 s.
export const PENDING_MS = 5000;
export function nextTarget(v, pending, dir, now = Date.now()) {
  const p = pending?.[v.climate];
  const base = p && now - p.at < PENDING_MS && p.t !== v.target ? p.t : v.target;
  return base == null ? null : Math.round(Math.min(v.max, Math.max(v.min, base + STEP * dir)) * 10) / 10;
}

const svg = (path, size, extra = '') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" ${extra}><path d="${path}"></path></svg>`;
const stroke = (path, size, w = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" aria-hidden="true"><path d="${path}"></path></svg>`;
const spinner = '<svg class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" stroke-linecap="round"></path></svg>';
const LEVEL_ICON = {
  success: stroke('M5 12l5 5L20 7', 16, 2.2),
  info: stroke('M12 11v6M12 7.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 16),
  warning: stroke('M12 9v5M12 17.5v.01M12 3 2 20h20z', 16),
  error: stroke('M12 8v5M12 16.5v.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 16),
};
const MODES = [
  ['on', 'Zapnuto', svg(ICON.fire, 15, 'style="color:#E8592C"')],
  ['by_weather', 'Počasí', stroke('M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 18z', 15)],
  ['off', 'Vypnuto', stroke('M12 3v8M6.3 7.3a8 8 0 1 0 11.4 0', 15)],
];

const PHASE_DOT = { heat: 'heat', fast: 'hot', run: 'run', closed: 'idle', idle: 'idle', window: 'dis', off: 'dis' };
const PHASE_ICON = { heat: ICON.fire, fast: ICON.fire, run: ICON.pipe, closed: ICON.closed, idle: ICON.fire, window: ICON.window, off: ICON.fire };

function tileHtml(v, cfg) {
  const flame = v.phase === 'heat' || v.phase === 'fast';
  const cls = ['tile', flame && 'hot', v.off && 'off'].filter(Boolean).join(' ');
  const bat = v.lowBattery.length > 0;
  const fmtT = (t) => (t == null ? '–' : fmt(t, 1));
  const glyph = `${svg(PHASE_ICON[v.phase], 20, flame ? 'class="flame"' : '')}${bat ? `<span class="badge blink">${svg(ICON.battery, 12)}</span>` : ''}`;
  const q = esc(v.climate);
  // the icon circle is its own button (info), the text is the tile's button (schedule); each only when its action is not `none`
  const dot = cfg.info_gesture === 'none' ? `<span class="dot ${PHASE_DOT[v.phase]}" data-zone="icon">${glyph}</span>`
    : `<button class="dot ${PHASE_DOT[v.phase]}" data-zone="icon" data-k="i:${q}" aria-label="Detail ${esc(v.name)}">${glyph}</button>`;
  const btn = cfg.schedule_gesture === 'none' ? '' : ` role="button" tabindex="0" data-k="m:${q}" aria-label="Rozvrh ${esc(v.name)}"`;
  return `<div class="${cls}" data-phase="${v.phase}">
  <div class="main dim" data-valve="${q}">
    ${dot}
    <div class="txt" data-zone="body"${btn}><div class="name">${esc(v.name)}</div><div class="state${bat ? ' blink low' : ''}">${esc(v.state)}</div></div>
  </div>
  <div class="ctl">
    <button class="pm" data-act="step" data-valve="${q}" data-d="-1" data-k="-:${q}" aria-label="Snížit cíl"${v.off ? ' disabled' : ''}>${stroke('M6 12h12', 14, 2.4)}</button>
    <span class="dim val">${fmtT(v.target)} °C</span>
    <button class="pm" data-act="step" data-valve="${q}" data-d="1" data-k="+:${q}" aria-label="Zvýšit cíl"${v.off ? ' disabled' : ''}>${stroke('M6 12h12M12 6v12', 14, 2.4)}</button>
  </div>
</div>`;
}

const WINDOW_CLOSED = 'M21 20V2H3V20H1V23H23V20M19 4V11H13V4M5 4H11V11H5M5 20V13H11V20M13 20V13H19V20Z';
const BATTERY_PLAIN = 'M16.67,4H15V2H9V4H7.33A1.33,1.33 0 0,0 6,5.33V20.67C6,21.4 6.6,22 7.33,22H16.67A1.33,1.33 0 0,0 18,20.67V5.33C18,4.6 17.4,4 16.67,4Z';

function chartHtml(m) {
  const font = 'font-size="11" style="fill: var(--c-text2)"';
  return `<svg viewBox="0 0 ${CHART.w} 140" width="100%" role="img" aria-label="Teplota za 24 hodin a cíl">
  ${m.bands.map((b, i) => `<rect class="band" x="${b.x}" y="${CHART.top}" width="${b.w}" height="${CHART.bottom - CHART.top}" rx="4"></rect>${i === 0 ? `<text x="${Math.min(b.x + 6, CHART.w - 30)}" y="24" font-size="11" class="band-t">okno</text>` : ''}`).join('')}
  <line x1="0" y1="${CHART.bottom}" x2="${CHART.w}" y2="${CHART.bottom}" style="stroke: var(--c-border)"></line>
  ${m.target ? `<path d="${m.target}" fill="none" style="stroke: var(--disabled-text-color, #a9afb7)" stroke-width="2" stroke-dasharray="4 4"></path>` : ''}
  <path d="${m.current}" fill="none" stroke="#E8592C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
  ${m.labels.map((l) => `<text x="${Math.min(l.x, CHART.w - 28)}" y="132" ${font}>${l.text}</text>`).join('')}
</svg>`;
}

// The valve dialog in sections that are patched separately (so the buttons keep their nodes):
// head, alert, now, tv (target label + value), chart, facts, wins. `chart` = chartModel() result, 'loading' or 'none'.
export function detailParts(d, chart = 'loading') {
  const v = d.view;
  const bat = d.battery?.low || v.lowBattery.some((b) => b.source === 'valve');
  const badged = v.lowBattery.length > 0;
  const fmtT = (t) => (t == null ? '–' : fmt(t, 1));
  const alert = d.alert ? `<div class="alert ${d.alert.kind === 'window' ? 'info' : 'error'} vd-alert" role="status">${d.alert.kind === 'window' ? svg(ICON.window, 18) : svg(ICON.battery, 18, 'class="blink"')}<span><b>${esc(d.alert.title)}</b>${esc(d.alert.text)}</span></div>` : '';
  const facts = [
    ['Baterie', d.battery ? `${fmt(d.battery.value)} %` : '—', bat],
    ['Signál brány', d.signal == null ? '—' : `${d.signal < 0 ? '−' : ''}${fmt(Math.abs(d.signal))} dBm`, false],
    ['Ventil', d.position == null ? '—' : `${fmt(d.position)} %`, false],
    ['Kalibrace', d.calibration === 'needed' ? 'Nutná' : d.calibration === 'ok' ? 'V pořádku' : '—', d.calibration === 'needed'],
  ];
  const dotCls = PHASE_DOT[v.phase];
  return {
    head: headMain(`${dotCls}${dotCls === 'idle' || dotCls === 'dis' ? ' soft' : ''}`, PHASE_ICON[v.phase], v.name, d.title,
      badged ? `<span class="badge blink">${svg(ICON.battery, 12)}</span>` : ''),
    alert,
    now: `<div><div class="sub">Teplota teď · ${esc(v.word.toLowerCase())}</div><div><b class="hero">${v.now == null ? '–' : fmt(v.now, 1)}</b> <span class="unit big">°C</span></div></div>
    ${d.position == null ? '' : `<span class="chip">ventil ${fmt(d.position)} %</span>`}`,
    tv: `<div class="lbl">${v.phase === 'window' ? 'Cíl · platí po zavření okna' : 'Cíl'}</div><div class="tv">${fmtT(v.target)} <small>°C</small></div>`,
    chart: chart === 'loading' ? '<div class="chart-msg">Načítám historii…</div>' : chart === 'none' ? '<div class="chart-msg">Historie není k dispozici.</div>' : chartHtml(chart),
    facts: facts.map(([l, val, low]) => `<div class="vd-tile${low ? ' low' : ''}"><div class="lbl">${l}</div><div class="fv${low ? ' blink' : ''}">${esc(val)}</div></div>`).join(''),
    wins: d.windows.length ? `<div class="vd-h">Okna (${d.windows.length})</div>
  <div class="vd-wins">${d.windows.map((w) => `<div class="vd-win">
    <span class="dot ${w.kind === 'open' ? 'winopen' : 'idle'}">${svg(w.kind === 'open' ? ICON.window : WINDOW_CLOSED, 18)}</span>
    <div class="txt"><div class="wn">${esc(winLabel(w.name))}</div><div class="ws${w.kind === 'open' ? ' open' : ''}">${esc(w.state)}</div></div>
    ${w.battery == null ? '' : `<span class="chip${w.lowBattery ? ' low' : ''}${w.lowBattery ? ' blink' : ''}">${svg(BATTERY_PLAIN, 12)}${fmt(w.battery)} %</span>`}
  </div>`).join('')}</div>` : '',
  };
}

// The dialog's fixed frame; `parts` fill the slots (empty at first), `climate` goes on the stepper, `off` disables it.
export function detailShell(parts = {}, climate = '', off = false, win = false) {
  const q = esc(climate);
  const dis = off ? ' disabled' : '';
  return `<div class="vd-head"><span class="s" data-p="head">${parts.head ?? ''}</span>
    <button class="x big" data-act="history" data-k="history" aria-label="Historie teploty">${stroke('M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2', 20)}</button>
    <button class="x big" data-act="close" data-k="close" aria-label="Zavřít">${stroke('M6 6l12 12M18 6 6 18', 20)}</button>
  </div>
  <div class="s" data-p="alert">${parts.alert ?? ''}</div>
  <div class="vd-now" data-p="now">${parts.now ?? ''}</div>
  <div class="soft vd-target${win ? ' off' : ''}">
    <div class="tvw" data-p="tv">${parts.tv ?? ''}</div>
    <button class="pm raised" data-act="step" data-valve="${q}" data-d="-1" data-k="-" aria-label="Snížit cíl"${dis}>${stroke('M6 12h12', 14, 2.4)}</button>
    <button class="pm raised" data-act="step" data-valve="${q}" data-d="1" data-k="+" aria-label="Zvýšit cíl"${dis}>${stroke('M6 12h12M12 6v12', 14, 2.4)}</button>
  </div>
  <figure class="vd-chart" data-p="chart">${parts.chart ?? ''}</figure>
  <div class="vd-h">Hlavice</div>
  <div class="vd-facts" data-p="facts">${parts.facts ?? ''}</div>
  <div class="s" data-p="wins">${parts.wins ?? ''}</div>
  <div class="vd-foot">
    <button class="sb soft" data-act="calibrate" data-k="calibrate">Kalibrovat</button>
    <button class="sb primary" data-act="schedule" data-k="schedule">Rozvrh</button>
  </div>`;
}

// Everything in one string (tests).
export const detailHtml = (d, chart) => detailShell(detailParts(d, chart), d.view.climate, d.view.off, d.view.phase === 'window');

function box1Html(c) {
  const syncing = c.applying.on && c.applying.trigger === 'sync';
  const programApplying = c.applying.on && c.applying.trigger === 'program';
  return `<div class="head">
    <div class="dot ${c.boilerOn ? 'heat' : 'idle'}">${svg(ICON.fire, 20, c.boilerOn ? 'class="flame"' : '')}</div>
    <div class="txt"><h2>${esc(c.title)}</h2><div class="sub">${esc(c.subtitle)}</div></div>
    ${c.outdoor == null ? '' : `<div class="live"><b>${fmt(c.outdoor, 1)}</b> <span class="unit">°C</span><small>venku teď</small></div>`}
  </div>
  ${c.status ? `<div class="alert ${c.status.level}" role="status">${LEVEL_ICON[c.status.level]}<span>${esc(c.status.text)}</span>
    <button class="x" data-act="clear" data-k="clear" aria-label="Zavřít zprávu">${stroke('M6 6l12 12M18 6 6 18', 14)}</button></div>` : ''}
  <div class="seg" role="group" aria-label="Režim topení">
    ${MODES.map(([val, label, icon]) => `<button data-act="mode" data-val="${val}" data-k="mode:${val}" aria-pressed="${c.mode === val}"${c.mode === val && c.hint ? ` title="${esc(c.hint)}"` : ''}${c.mode === val ? ' class="on"' : ''}>${icon}${label}</button>`).join('')}
  </div>
  <div class="soft panel">
    <div class="facts">
      <div><div class="lbl">Program</div><div class="v">${programApplying ? `<span class="applying">${spinner}Nastavuji… ${c.applying.left}</span>` : esc(c.programName)}</div></div>
      <div><div class="lbl">Mimo rozvrh</div><div class="v">${c.offSchedule} <small>${pluralWord(c.offSchedule, 'hlavice', 'hlavice', 'hlavic')}</small></div></div>
    </div>
    <button class="sb" data-act="sync" data-k="sync"${syncing ? ' disabled' : ''}>${syncing ? spinner : ''}Srovnat</button>
    <button class="sb" data-act="open" data-val="program" data-k="open:program">Program</button>
  </div>
  <div class="vd-foot"><button class="sb soft" data-act="open" data-val="settings" data-k="open:settings">${svg(ICON.cog, 15)}Nastavení</button></div>`;
}

// The card's HTML in the pieces that are patched separately: box 1, the box 2 summary, one string per tile.
// `pending` = ± targets sent but not yet reported by hass (climate -> {t, at}).
export function cardParts(hass, cfg, pending = {}) {
  const views = cfg.valves.map((v) => {
    const x = valveView(hass, cfg, v);
    return pending[v] ? { ...x, target: pending[v].t } : x;
  });
  return { box1: box1Html(circuitView(hass, cfg)), summary: valvesSummary(views), tiles: views.map((v) => tileHtml(v, cfg)) };
}

export function cardHtml(hass, cfg, pending) {
  const p = cardParts(hass, cfg, pending);
  return `<div class="card">${p.box1}</div>
<div class="card">
  <div class="head2"><div class="h">Hlavice</div><div class="sub">${esc(p.summary)}</div></div>
  <div class="grid">${p.tiles.join('')}</div>
</div>`;
}

// Every entity box 1 and the tiles read; a hass update re-renders only when one of these changed.
const CIRCUIT_ENTITIES = [
  ['switch', 'boiler'], ['input_select', 'heating_mode'], ['input_select', 'heating_auto_rule'], ['input_datetime', 'heating_time_from'],
  ['input_datetime', 'heating_time_to'], ['input_number', 'heating_weather_threshold'], ['input_text', 'heating_status'],
  ['select', 'heating_program'], ['sensor', 'heating_program'], ['sensor', 'heating_applying'], ['sensor', 'heating_off_schedule'],
  ['sensor', 'heating_valves'], ['sensor', 'heating_low_batteries'], ['sensor', 'heating_outdoor_temperature'],
  ['binary_sensor', 'heating_active'], ['binary_sensor', 'heating_state'],
];
export const watchedIds = (cfg) => [...CIRCUIT_ENTITIES.map(([d, n]) => eid(cfg, d, n)), ...cfg.valves];

// ---- Generic dialog frame (#445; reused by the settings and statistics dialogs) ----

// Head of every dialog: icon circle (+ optional badge html), context line (the circuit title), title.
export const headMain = (dotClass, iconPath, title, context, badge = '') => `<span class="dot ${esc(dotClass)}">${svg(iconPath, 20)}${badge}</span>
  <div class="txt"><div class="sub">${esc(context)}</div><h2 class="vd-title">${esc(title)}</h2></div>`;

// Head of a generic dialog: headMain + close button.
export const dialogHead = (dotClass, iconPath, title, context) => `${headMain(dotClass, iconPath, title, context)}
  <button class="x big" data-act="gclose" data-k="gclose" aria-label="Zavřít">${stroke('M6 6l12 12M18 6 6 18', 20)}</button>`;

// The fixed frame: a head slot and a body slot (patched separately, see HeatingCard._refreshGeneric).
const gdShell = '<div class="vd-head" data-p="head"></div><div class="s" data-p="body"></div>';

// ---- Program dialog (design V6-Program) ----

const HOLIDAY_ID = ['input_text', 'heating_holiday_calendar'];

// The program id: the sensor, else the select when its state is a real option; never "unavailable".
export function programId(hass, cfg) {
  const sensor = st(hass, eid(cfg, 'sensor', 'heating_program'));
  if (!BAD.includes(sensor)) return sensor;
  const sel = eid(cfg, 'select', 'heating_program');
  const s = st(hass, sel);
  return !BAD.includes(s) && (at(hass, sel, 'options') ?? []).includes(s) ? s : null;
}

const programLabel = (hass, cfg, id) => (id == null ? '—'
  : at(hass, eid(cfg, 'sensor', 'heating_program'), 'program_names')?.[id] ?? T.program[id] ?? id);

export function programIcon(id) {
  if (id === 'auto') return ICON.calendarWeek;
  if (/weekend|vikend/i.test(id)) return ICON.homeOutline;
  if (/office/i.test(id)) return ICON.laptop;
  if (/holiday|vacation|dovolena/i.test(id)) return ICON.beach;
  if (/sick|nemoc/i.test(id)) return ICON.sick;
  return ICON.calendarStar;
}

// `dnes 18:02` / `včera 18:02` / `7. 11. 18:02`; `—` for a missing or unparsable time.
export function whenText(iso, now = Date.now()) {
  const t = new Date(iso);
  if (!iso || Number.isNaN(t.getTime())) return '—';
  const hm = `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;
  const today = new Date(now).setHours(0, 0, 0, 0);
  const days = Math.round((today - new Date(t).setHours(0, 0, 0, 0)) / 86400000);
  return `${days === 0 ? 'dnes' : days === 1 ? 'včera' : `${t.getDate()}. ${t.getMonth() + 1}.`} ${hm}`;
}

// `17. 11. Den boje za svobodu` from `{date: '2026-11-17', name}`.
const holidayText = (h) => {
  const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(h?.date ?? '');
  return m ? `${Number(m[3])}. ${Number(m[2])}. ${h.name ?? ''}`.trim() : '';
};

// Everything the program dialog shows. Pure; `now` (ms) only for `Program změněn`.
// `calendarIds` = the calendar.* entities (the card resolves them once per open dialog); `pending` = a tapped program id.
export function programView(hass, cfg, now = Date.now(), calendarIds = Object.keys(hass.states ?? {}).filter((id) => id.startsWith('calendar.')), pending = null) {
  const e = (d, n) => eid(cfg, d, n);
  const selectable = !!hass.states?.[e('select', 'heating_program')];
  const current = pending ?? programId(hass, cfg);
  // no select: nothing can be switched, the list shows the current program read-only
  const ids = selectable ? at(hass, e('select', 'heating_program'), 'options') ?? ['auto'] : [current ?? 'auto'];
  const altState = st(hass, e('input_boolean', 'heating_week_alternation'));
  const alternation = altState === 'on' ? true : altState === 'off' ? false : null; // null: no helper, row hidden
  const sch = e('sensor', 'heating_schedule');
  const week = at(hass, sch, 'week');
  const weekWord = week === 'odd' ? 'lichý' : week === 'even' ? 'sudý' : '';
  const weekNumber = num(at(hass, sch, 'week_number'));
  const programs = ids.map((id) => ({
    id, name: programLabel(hass, cfg, id), icon: programIcon(id), current: id === current,
    detail: id === 'auto' ? `rozvrh hlavic${alternation && weekWord ? ` · ${weekWord} týden` : ''}` : '',
  }));

  const ap = applyingState(hass, cfg);
  const total = cfg.valves.length;
  const applying = ap.on && (ap.trigger === 'program' || ap.trigger === 'sync')
    ? { trigger: ap.trigger, name: programLabel(hass, cfg, current), progress: `${Math.min(total, Math.max(0, total - ap.left))} ze ${total}` }
    : null;

  // holidays: null = no helper (hidden), '' = unavailable / unknown (no segment pressed), else none / calendar
  const holState = st(hass, e('input_select', 'heating_holidays'));
  const holidays = hass.states?.[e('input_select', 'heating_holidays')] ? (holState === 'calendar' || holState === 'none' ? holState : '') : null;
  const hasCalendar = !!hass.states?.[e(...HOLIDAY_ID)]; // no helper: no calendar row
  const calendar = st(hass, e(...HOLIDAY_ID)) ?? '';
  const calendars = calendarIds.map((id) => ({ id, name: at(hass, id, 'friendly_name') || id }));
  if (calendar && !BAD.includes(calendar) && !calendars.some((c) => c.id === calendar)) calendars.push({ id: calendar, name: calendar });
  const off = num(st(hass, e('sensor', 'heating_off_schedule'))) ?? 0;
  const scheduled = Math.max(0, total - off);
  const changed = hass.states?.[e('sensor', 'heating_program')]?.last_changed;
  return {
    title: circuitTitle(hass, cfg), programs, current, selectable, hasCalendar, applying, syncing: applying?.trigger === 'sync',
    alternation, weekLabel: weekWord ? `Teď ${weekWord}${weekNumber == null ? '' : ` (${weekNumber}.)`}` : '',
    holidays, calendar: BAD.includes(calendar) ? '' : calendar, calendars,
    nextHoliday: holidayText((at(hass, sch, 'holidays_next') ?? [])[0]),
    tiles: {
      schedule: { value: `${scheduled} ze ${total}`, caption: applying ? 'zbytek se nastavuje' : off === 0 ? 'všechny' : `${off} mimo rozvrh` },
      changed: { value: whenText(changed, now) },
    },
  };
}

// The program dialog in the frame's slots: {head, body}.
export function programParts(v) {
  const alert = v.applying ? `<div class="alert info vd-alert" role="status"><span class="spin" style="display:flex;flex:none">${svg(ICON.sync, 18)}</span><span>${
    v.applying.trigger === 'sync' ? 'Srovnávám hlavice' : `Nastavuji hlavice podle programu <b>${esc(v.applying.name)}</b>`} · ${esc(v.applying.progress)}</span></div>` : '';
  const rows = v.programs.map((p) => `<button role="radio" aria-checked="${p.current}"${v.selectable ? '' : ' disabled'} data-act="program" data-val="${esc(p.id)}" data-k="p:${esc(p.id)}"${p.current ? ' class="on"' : ''}>
      <span class="dot sm ${p.current ? 'heat' : 'idle'}">${svg(p.icon, 18)}</span>
      <span class="txt"><span class="n">${esc(p.name)}</span>${p.detail ? `<span class="d">${esc(p.detail)}</span>` : ''}</span>
      <span class="ck">${svg(ICON.check, 16)}</span></button>`).join('');
  const alternation = v.alternation == null ? '' : `<div class="fld soft">
    <div class="fl"><div class="t">Střídat lichý a sudý týden</div><div class="help">Rozvrhy označené lichý / sudý platí jen v daném týdnu.${v.weekLabel ? ` ${esc(v.weekLabel)}.` : ''}</div></div>
    <button class="sw${v.alternation ? ' on' : ''}" role="switch" aria-checked="${v.alternation}" aria-label="Střídat lichý a sudý týden" data-act="alternation" data-k="alternation"></button>
  </div>`;
  const holidays = v.holidays == null ? '' : `<div class="seg two" role="group" aria-label="Svátky">
    ${[['none', 'Svátky jako všední den'], ['calendar', 'Svátky jako neděle']].map(([val, label]) =>
      `<button data-act="holidays" data-val="${val}" data-k="hol:${val}" aria-pressed="${v.holidays === val}"${v.holidays === val ? ' class="on"' : ''}>${label}</button>`).join('')}
  </div>${v.holidays === 'calendar' && v.hasCalendar ? `<div class="fld soft">
    <div class="fl"><div class="lbl">Kalendář svátků</div>
      <select class="sel" data-act="calendar" data-k="calendar" aria-label="Kalendář svátků"><option value=""${v.calendar ? '' : ' selected'}>— vyber kalendář —</option>${
        v.calendars.map((c) => `<option value="${esc(c.id)}"${c.id === v.calendar ? ' selected' : ''}>${esc(c.name)} · ${esc(c.id)}</option>`).join('')}</select>
      ${v.nextHoliday ? `<div class="help">Další: ${esc(v.nextHoliday)}</div>` : ''}</div>
  </div>` : ''}`;
  return {
    head: dialogHead('run', ICON.calendarWeek, 'Program', v.title),
    body: `${alert}
  <div class="prog" role="radiogroup" aria-label="Program">${rows}</div>
  <div class="help prog-help">${v.selectable ? 'Program vybere rozvrh všech hlavic okruhu. Ruční změnu na hlavici přepíše další krok rozvrhu.' : 'Program nejde přepnout: chybí výběr programu okruhu.'}</div>
  <div class="vd-h">Týdny a svátky</div>
  ${alternation}${holidays}
  <div class="vd-facts">
    <div class="vd-tile"><div class="lbl">Hlavic podle rozvrhu</div><div class="fv">${esc(v.tiles.schedule.value)}</div><div class="cap">${esc(v.tiles.schedule.caption)}</div></div>
    <div class="vd-tile"><div class="lbl">Program změněn</div><div class="fv">${esc(v.tiles.changed.value)}</div></div>
  </div>
  <div class="vd-foot">
    <button class="sb soft" data-act="sync" data-k="sync"${v.syncing ? ' disabled' : ''}>${v.syncing ? spinner : svg(ICON.sync, 16)}Srovnat hlavice</button>
    <button class="sb primary" data-act="programs" data-k="programs">${svg(ICON.pencil, 16)}Upravit programy</button>
  </div>`,
  };
}

export const programHtml = (v) => { const p = programParts(v); return p.head + p.body; };

// ---- Settings dialog (design V7-SettingsRule / Boiler / Windows / Other) ----

const SET_TABS = [['rule', 'Pravidlo', ICON.thermometer], ['boiler', 'Kotel', ICON.fire], ['windows', 'Okna', WINDOW_CLOSED], ['other', 'Ostatní', ICON.tune]];
const OUTDOOR_SOURCE = 'input_text.heating_outdoor_temperature_source'; // shared by all circuits

// The tab that is shown: Kotel only with `condensing_boiler`, an unknown tab falls back to Pravidlo.
export const settingsTab = (cfg, tab) => (SET_TABS.some(([id]) => id === tab) && (tab !== 'boiler' || cfg.condensing_boiler) ? tab : 'rule');

// Every sensor.* with device_class temperature and every weather.* (the outdoor temperature picker).
export const outdoorSources = (hass) => Object.keys(hass.states ?? {}).filter((id) => id.startsWith('weather.')
  || (id.startsWith('sensor.') && hass.states[id].attributes?.device_class === 'temperature'));

const decimals = (step) => (String(step).split('.')[1] ?? '').length;

// A number field from an input_number: value / unit / min / max / step come from its state; null when it is missing or not a number.
// `def` = {label, icon, help}; `pending` = {id: {v, at}}, a ± value sent but not yet reported (shown until hass reports it or PENDING_MS).
export function numField(hass, id, def = {}, pending = {}, now = Date.now()) {
  const s = hass.states?.[id];
  const value = num(s?.state);
  if (value == null) return null;
  const a = s.attributes ?? {};
  const step = num(a.step) ?? 1;
  const p = pending[id];
  const shown = p && now - p.at < PENDING_MS ? p.v : value;
  const unit = a.unit_of_measurement ?? '';
  return {
    id, label: def.label, icon: def.icon, value: shown, text: fmt(shown, decimals(step)), unit, min: num(a.min) ?? 0, max: num(a.max) ?? 100, step,
    help: def.help ?? `Krok ${fmt(step, decimals(step))}${unit ? ` ${unit}` : ''}`,
  };
}

// field value ± one step, clamped to min / max and rounded to the step's decimals (0.3 + 0.1 = 0.4, no float noise).
export const stepNum = (f, dir) => Number(Math.min(f.max, Math.max(f.min, f.value + f.step * dir)).toFixed(decimals(f.step)));

const srcValue = (hass, id) => {
  const s = hass.states?.[id];
  return s ? num(id.startsWith('weather.') ? s.attributes?.temperature ?? s.state : s.state) : null;
};
const srcLabel = (hass, id) => {
  const v = srcValue(hass, id);
  return `${at(hass, id, 'friendly_name') || id}${v == null ? '' : ` · ${fmt(v, 1)} °C`}`;
};
const hhmm = (v) => { const t = String(v ?? '').slice(0, 5); return /^\d\d:\d\d$/.test(t) ? t : ''; };
const minutesSince = (iso, now) => { const t = Date.parse(iso); return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 60000)) : null; };
const isOpen = (w) => w.open === true || w.state === 'on';

const SETTING_FIELDS = {
  threshold: ['input_number', 'heating_weather_threshold', { label: 'Topit pod venkovní teplotou', icon: ICON.thermoLow }],
  fast: ['input_number', 'heating_fast_start_delta', { label: 'Rychlý start pod rozvrhem', icon: ICON.rocket, help: 'Hlavice otevře naplno, když je místnost o tolik pod cílem.' }],
  bypass: ['input_number', 'heating_bypass_threshold', { label: 'Kotel topí pro hlavici otevřenou od', icon: ICON.valve, help: 'Menší otevření kotel nezapne (kromě rychlého startu).' }],
  margin: ['input_number', 'heating_close_margin', { label: 'Zavřít doběh nad rozvrhem', icon: ICON.thermoUp, help: 'Doběh skončí, když místnost přeteče o tolik nad cíl.' }],
  overrun: ['input_number', 'heating_bypass_overrun', { label: 'Doběh čerpadla', icon: ICON.pump, help: 'Poslední otevřená hlavice drží vodu v oběhu, než kotel dojede.' }],
  release: ['input_number', 'heating_release_check', { label: 'Kontrola po uvolnění hlavice', icon: ICON.timerSand, help: 'Pak se ověří, že hlavice opravdu zavřela.' }],
  reminder: ['input_number', 'heating_window_reminder', { label: 'Připomenout otevřené okno po', icon: ICON.bellRing, help: '0 = nepřipomínat. Notifikace jde do kanálu okruhu.' }],
};
const SHARED_FIELDS = {
  battery: ['input_number.heating_low_battery_threshold', { label: 'Slabá baterie pod', icon: ICON.batteryLow, help: 'Hlavice a okenní čidla pod prahem blikají a přijde upozornění.' }],
  status: ['input_number.heating_status_duration', { label: 'Stavová zpráva svítí', icon: ICON.message, help: 'Jak dlouho karta ukazuje „Program nastaven“ apod.' }],
};
const fieldsOf = (hass, cfg, keys, ctx) => keys.map((k) => {
  const [d, n, def] = SETTING_FIELDS[k];
  return numField(hass, eid(cfg, d, n), def, ctx.nums);
}).filter(Boolean);

const SETTINGS_TAB = {
  rule(hass, cfg, ctx, now) {
    const e = (d, n) => eid(cfg, d, n);
    const rule = st(hass, e('input_select', 'heating_auto_rule')) === 'time' ? 'time' : 'weather';
    const [threshold] = fieldsOf(hass, cfg, ['threshold'], ctx);
    const times = [['heating_time_from', 'Topit od', ICON.clockStart], ['heating_time_to', 'Topit do', ICON.clockEnd]]
      .filter(([n]) => hass.states?.[e('input_datetime', n)])
      .map(([n, label, icon]) => ({ id: e('input_datetime', n), label, icon, value: hhmm(st(hass, e('input_datetime', n))) }));
    const srcState = hass.states?.[OUTDOOR_SOURCE];
    const current = srcState?.state;
    const list = ctx.sources ?? [];
    const ids = BAD.includes(current) || current === '' || list.includes(current) ? list : [...list, current];
    const source = srcState ? {
      id: OUTDOOR_SOURCE, label: 'Venkovní teplota z', icon: ICON.cloudOutline, value: current ?? '',
      options: ids.map((id) => ({ id, label: srcLabel(hass, id) })),
      help: `${BAD.includes(current) || current === '' ? 'nevybráno' : current} · společné pro všechny okruhy`,
    } : null;
    // what the rule decides right now (sensor.heating_weather_ok_<c>: on / off)
    const ok = st(hass, e('sensor', 'heating_weather_ok'));
    let alert = null;
    if (ok === 'on' || ok === 'off') {
      const out = num(st(hass, e('sensor', 'heating_outdoor_temperature')));
      const x = threshold?.value;
      const d = new Date(now);
      const when = rule === 'time'
        ? `Je ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}, mezi ${times[0]?.value || '–'} a ${times[1]?.value || '–'}`
        : `Venku ${out == null ? '–' : fmt(out, 1)} °C, pod ${x == null ? '–' : fmt(x, Number.isInteger(x) ? 0 : 1)} °C`;
      alert = ok === 'on' ? { level: 'success', text: `${when} – kotel smí v režimu Počasí topit.` } : { level: 'info', text: `${when} – v režimu Počasí kotel teď netopí.` };
    }
    return { rule, hasRule: !!hass.states?.[e('input_select', 'heating_auto_rule')], alert, fields: threshold ? [threshold] : [], source, times };
  },

  boiler(hass, cfg, ctx) {
    const e = (d, n) => eid(cfg, d, n);
    const phases = at(hass, e('sensor', 'heating_valves'), 'phases') ?? {};
    const demand = at(hass, e('sensor', 'heating_valves'), 'demand') ?? [];
    let fast = 0, run = 0, heat = 0;
    for (const v of cfg.valves) {
      const raw = phases[v]?.[0];
      if (raw === 'fast') fast++;
      else if (raw === 'run' || raw === 'overrun') run++;
      else if (demand.includes(v)) heat++;
    }
    const parts = [fast && `${fast} rychlý start`, heat && `${heat} topí`, run && `${run} doběh`].filter(Boolean);
    return { fields: fieldsOf(hass, cfg, ['fast', 'bypass', 'margin', 'overrun', 'release'], ctx), now: `Hlavice teď: ${parts.length ? parts.join(', ') : 'žádná netopí'}.` };
  },

  windows(hass, cfg, ctx) {
    const rows = cfg.valves.map((v) => {
      const ws = windowList(hass, cfg, v);
      return {
        climate: v, name: at(hass, v, 'friendly_name') || v.split('.')[1], count: ws.length,
        windows: ws.map((w) => ({ text: winLabel(w.name || w.entity_id), open: isOpen(w) })),
      };
    });
    return { fields: fieldsOf(hass, cfg, ['reminder'], ctx), rows };
  },

  other(hass, cfg, ctx, now) {
    const e = (d, n) => eid(cfg, d, n);
    const fields = Object.values(SHARED_FIELDS).map(([id, def]) => numField(hass, id, def, ctx.nums)).filter(Boolean);
    const lowRows = at(hass, e('sensor', 'heating_low_batteries'), 'low_battery') ?? [];
    const low = new Set(lowRows.map((r) => r.climate).filter((c) => cfg.valves.includes(c))).size;
    const all = cfg.valves.flatMap((v) => windowList(hass, cfg, v));
    const openWins = all.filter(isOpen).length;
    const boiler = hass.states?.[e('switch', 'boiler')];
    const bs = boiler?.state === 'on' ? 'zapnuto' : boiler?.state === 'off' ? 'vypnuto' : 'neznámý';
    const mins = minutesSince(boiler?.last_changed, now);
    const out = num(st(hass, e('sensor', 'heating_outdoor_temperature')));
    return {
      fields, channel: cfg.circuit,
      tiles: [
        { icon: ICON.radiator, label: 'Hlavice', value: String(cfg.valves.length), caption: low ? `${low} se slabou baterií` : 'žádná se slabou baterií' },
        { icon: WINDOW_CLOSED, label: 'Okenní čidla', value: String(all.length), caption: openWins ? `${openWins} otevřené` : 'žádné otevřené' },
        { icon: ICON.relay, label: 'Kotel', value: e('switch', 'boiler'), small: true, caption: `${bs}${mins == null ? '' : ` · ${mins} min`}` },
        { icon: ICON.thermometer, label: 'Venku', value: out == null ? '—' : `${fmt(out, 1)} °C`, caption: 'čidlo okruhu' },
      ],
    };
  },
};

// Everything the settings dialog shows for `tab`. Pure; `ctx` = {nums: pending ± values, sources: outdoorSources()}, `now` (ms) for the clock and minutes.
export function settingsView(hass, cfg, tab = 'rule', ctx = {}, now = Date.now()) {
  const cur = settingsTab(cfg, tab);
  return {
    title: circuitTitle(hass, cfg), tab: cur,
    tabs: SET_TABS.filter(([id]) => id !== 'boiler' || cfg.condensing_boiler).map(([id, label, icon]) => ({ id, label, icon })),
    ...SETTINGS_TAB[cur](hass, cfg, { nums: {}, sources: [], ...ctx }, now),
  };
}

const stepBtn = (f, d) => `<button class="pm raised" data-act="num" data-id="${esc(f.id)}" data-d="${d}" data-k="n${d}:${esc(f.id)}" aria-label="${esc(f.label)}: ${d < 0 ? 'méně' : 'více'}">${stroke(d < 0 ? 'M6 12h12' : 'M6 12h12M12 6v12', 18, 2.2)}</button>`;
const fieldHtml = (f) => `<div class="soft field"><span class="fi">${svg(f.icon, 18)}</span>
    <div class="fl"><div class="lbl">${esc(f.label)}</div><div class="fval">${esc(f.text)}${f.unit ? ` <span class="unit">${esc(f.unit)}</span>` : ''}</div><div class="help">${esc(f.help)}</div></div>
    ${stepBtn(f, -1)}${stepBtn(f, 1)}</div>`;
const pickHtml = (f, control) => `<div class="soft field"><span class="fi">${svg(f.icon, 18)}</span>
    <div class="fl"><div class="lbl">${esc(f.label)}</div>${control}${f.help ? `<div class="help">${esc(f.help)}</div>` : ''}</div>
    <span class="go">${svg(ICON.chevron, 20)}</span></div>`;
const sourceHtml = (s) => pickHtml(s, `<select class="pick fval t" data-act="pick" data-id="${esc(s.id)}" data-k="pick:${esc(s.id)}" aria-label="${esc(s.label)}">${
  s.value ? '' : '<option value="" selected>— vyber čidlo —</option>'}${s.options.map((o) => `<option value="${esc(o.id)}"${o.id === s.value ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`);
const timeHtml = (t) => pickHtml(t, `<input class="pick fval t" type="time" value="${esc(t.value)}" data-act="pick" data-id="${esc(t.id)}" data-k="pick:${esc(t.id)}" aria-label="${esc(t.label)}">`);
const fieldList = (fs) => `<div class="fields">${fs.map(fieldHtml).join('')}</div>`;
const boldMode = (s) => esc(s).replace('Počasí', '<b>Počasí</b>');

const SETTINGS_BODY = {
  rule: (v) => `${v.alert ? `<div class="alert ${v.alert.level} vd-alert" role="status">${LEVEL_ICON[v.alert.level]}<span>${boldMode(v.alert.text)}</span></div>` : ''}
  ${v.hasRule ? `<div class="vd-h">Režim Počasí řídí</div>
  <div class="seg two" role="group" aria-label="Pravidlo režimu Počasí">
    ${[['weather', 'Venkovní teplota', ICON.thermometer], ['time', 'Čas', ICON.clock]].map(([val, label, icon]) =>
      `<button data-act="rule" data-val="${val}" data-k="rule:${val}" aria-pressed="${v.rule === val}"${v.rule === val ? ' class="on"' : ''}>${svg(icon, 16)}${label}</button>`).join('')}
  </div>` : ''}
  ${v.rule === 'weather' ? `<div class="fields">${v.fields.map(fieldHtml).join('')}${v.source ? sourceHtml(v.source) : ''}</div>`
    : `<div class="pair">${v.times.map(timeHtml).join('')}</div>`}
  <div class="help">Pravidlo platí jen v režimu <b>Počasí</b>. V režimu Zapnuto kotel topí podle hlavic vždy, ve Vypnuto nikdy. Změny platí hned.</div>`,

  boiler: (v) => `<div class="vd-h">Fáze hlavice u kondenzačního kotle</div>
  <figure class="phase" aria-label="Fáze hlavice: rychlý start, topí, doběh, kontrola">
    <div class="ph"><div class="p-fast">Rychlý start</div><div class="p-heat">Topí</div><div class="p-run">Doběh</div><div class="p-chk">Kontrola</div></div>
    <div class="cap"><span>pod rozvrhem</span><span>rozvrh dosažen</span><span>hlavice zavřená</span></div>
  </figure>
  ${fieldList(v.fields)}
  <div class="help">${esc(v.now)} Změny platí hned.</div>`,

  windows: (v) => `${v.fields.map(fieldHtml).join('')}
  <div class="vd-h">Okenní čidla hlavic</div>
  <div class="vd-wins">${v.rows.map((r) => `<div class="vd-win">
    <span class="dot sm idle">${svg(ICON.radiator, 18)}</span>
    <div class="txt"><div class="wn">${esc(r.name)}</div><div class="ws">${r.windows.length
      ? r.windows.map((w) => (w.open ? `<span class="open">${esc(w.text)} · otevřené</span>` : esc(w.text))).join(' · ') : 'bez okenního čidla'}</div></div>
    <span class="cnt">${r.count}</span></div>`).join('')}</div>
  <div class="alert info vd-alert" role="status">${LEVEL_ICON.info}<span>Okna k hlavicím přiřadíš v aplikaci Homecraft (Topení → Hlavice → Okna). Otevřené okno zavře svou hlavici, po zavření se vrátí rozvrh.</span></div>`,

  other: (v) => `<div class="vd-h">Pro všechny okruhy</div>
  ${fieldList(v.fields)}
  <div class="vd-h">Upozornění</div>
  <div class="soft field"><span class="fi">${svg(ICON.bellOutline, 18)}</span>
    <div class="fl"><div class="lbl">Kanál notifikací</div><div class="fval t">${esc(v.channel)}</div><div class="help">Nastavíš ve funkci Notifikace v aplikaci Homecraft.</div></div></div>
  <div class="vd-h">Okruh</div>
  <div class="vd-facts">${v.tiles.map((t) => `<div class="vd-tile"><div class="lbl"><span class="li">${svg(t.icon, 14)}</span>${esc(t.label)}</div><div class="fv${t.small ? ' s' : ''}">${esc(t.value)}</div><div class="cap">${esc(t.caption)}</div></div>`).join('')}</div>`,
};

// The settings dialog in the frame's slots: {head, body}.
export function settingsParts(v) {
  const tabs = `<div class="seg tabs ${v.tabs.length === 4 ? 'four' : ''}" role="tablist" aria-label="Oblast nastavení">${v.tabs.map((t) =>
    `<button role="tab" aria-selected="${t.id === v.tab}" data-act="tab" data-val="${t.id}" data-k="tab:${t.id}"${t.id === v.tab ? ' class="on"' : ''}>${svg(t.icon, 16)}${t.label}</button>`).join('')}</div>`;
  return { head: dialogHead('idle soft', ICON.cog, 'Nastavení', v.title), body: `${tabs}\n  ${SETTINGS_BODY[v.tab](v)}` };
}

export const settingsHtml = (v) => { const p = settingsParts(v); return p.head + p.body; };

// Generic dialogs by kind: the entity ids a dialog reads (a hass update re-renders it only when one changed)
// and its {head, body}. #447 adds `stats` here.
const DIALOGS = {
  program: {
    label: 'Program',
    // ctx = what _openDialog resolved once: {calendars: [calendar.* ids], pending: {id, at} | null}
    ids: (hass, cfg, ctx) => [
      ...[['select', 'heating_program'], ['sensor', 'heating_program'], ['sensor', 'heating_applying'], ['sensor', 'heating_schedule'],
        ['input_boolean', 'heating_week_alternation'], ['input_select', 'heating_holidays'], HOLIDAY_ID, ['sensor', 'heating_off_schedule'],
        ['binary_sensor', 'heating_state']].map(([d, n]) => eid(cfg, d, n)),
      ...ctx.calendars,
    ],
    parts: (hass, cfg, ctx) => programParts(programView(hass, cfg, Date.now(), ctx.calendars, ctx.pending?.id ?? null)),
  },
  settings: {
    label: 'Nastavení',
    // ctx.tab = the open tab, ctx.nums = pending ± values, ctx.sources = the outdoor temperature candidates
    ids: (hass, cfg, ctx) => {
      const tab = settingsTab(cfg, ctx.tab);
      const e = (d, n) => eid(cfg, d, n);
      const per = {
        rule: [e('input_select', 'heating_auto_rule'), e('input_number', 'heating_weather_threshold'), e('input_datetime', 'heating_time_from'),
          e('input_datetime', 'heating_time_to'), e('sensor', 'heating_weather_ok'), e('sensor', 'heating_outdoor_temperature'), OUTDOOR_SOURCE,
          ...ctx.sources, st(hass, OUTDOOR_SOURCE)],
        boiler: [...['heating_fast_start_delta', 'heating_bypass_threshold', 'heating_close_margin', 'heating_bypass_overrun', 'heating_release_check']
          .map((n) => e('input_number', n)), e('sensor', 'heating_valves')],
        windows: [e('input_number', 'heating_window_reminder'), e('sensor', 'heating_off_schedule'), ...cfg.valves],
        other: ['input_number.heating_low_battery_threshold', 'input_number.heating_status_duration', e('sensor', 'heating_low_batteries'),
          e('sensor', 'heating_off_schedule'), e('switch', 'boiler'), e('sensor', 'heating_outdoor_temperature')],
      };
      return [...per[tab], e('binary_sensor', 'heating_state')].filter(Boolean);
    },
    parts: (hass, cfg, ctx) => settingsParts(settingsView(hass, cfg, ctx.tab, ctx)),
  },
};

const STYLE = `
:host { display: flex; flex-direction: column; gap: 12px; --c-card: var(--hfb-card, var(--card-background-color, #fff)); --c-border: var(--hfb-border, var(--divider-color, #e0e0e0)); --c-fill: var(--hfb-fill, var(--secondary-background-color, #f0f2f5)); --c-tile-bg: var(--hfb-tile-bg, var(--c-fill)); --c-tile-border: var(--hfb-tile-border, none); --c-tile-shadow: var(--hfb-tile-shadow, none); --c-tile-radius: var(--hfb-tile-radius, 14px); --c-text: var(--hfb-text, var(--primary-text-color, #1c2128)); --c-text2: var(--hfb-text-2, var(--secondary-text-color, #6e7682)); --c-accent: var(--hfb-accent, var(--primary-color, #4f6b8c)); --c-raised: var(--hfb-btn-raised-bg, var(--card-background-color, #fff)); --c-raised-sh: var(--hfb-btn-raised-shadow, none); --c-err: var(--error-color, #e5484d); color: var(--c-text); }
* { box-sizing: border-box; }
button { font: inherit; color: inherit; cursor: pointer; }
.card { background: var(--ha-card-background, var(--c-card)); border: 1px solid var(--c-border); border-radius: var(--ha-card-border-radius, var(--hfb-card-radius, 12px)); box-shadow: var(--ha-card-box-shadow, var(--hfb-card-shadow, none)); padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
.head { display: flex; align-items: center; gap: 10px; }
.txt { flex: 1; min-width: 0; }
h2 { margin: 0; font-size: 16px; font-weight: 500; }
.sub { font-size: 12px; color: var(--c-text2); }
.live { text-align: right; } .live b { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; }
.unit { font-size: 13px; font-weight: 500; color: var(--c-text2); } .live small { display: block; font-size: 11px; color: var(--c-text2); }
.dot { width: 36px; height: 36px; flex: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; position: relative; }
.dot.heat { background: var(--hfb-heat-dot, linear-gradient(145deg, #FFA66E, #E8592C)); box-shadow: var(--hfb-heat-glow, 0 0 0 3px rgba(232,89,44,.14), 0 2px 6px rgba(232,89,44,.32)); color: var(--hfb-dot-on-icon, #fff); }
.dot.hot { background: var(--hfb-hot-dot, linear-gradient(145deg, #FF7A38, #CF3416)); box-shadow: var(--hfb-hot-glow, 0 0 0 4px rgba(214,58,28,.18), 0 0 14px rgba(214,58,28,.5)); color: var(--hfb-dot-on-icon, #fff); }
.dot.run { background: var(--hfb-run-dot, linear-gradient(145deg, color-mix(in srgb, var(--primary-color, #4f6b8c) 65%, #fff), var(--primary-color, #4f6b8c))); box-shadow: var(--hfb-run-glow, 0 2px 6px color-mix(in srgb, var(--primary-color, #4f6b8c) 40%, transparent)); color: var(--hfb-dot-on-icon, #fff); }
button.dot { border: 0; padding: 0; cursor: pointer; font: inherit; }
.tw { display: contents; }
.dot.idle { background: var(--hfb-dot-idle, var(--card-background-color, #fff)); color: #607D8B; }
.dot.dis { background: var(--hfb-dot-idle, var(--card-background-color, #fff)); color: var(--disabled-text-color, #a9afb7); }
.alert { display: flex; align-items: center; gap: 10px; border-radius: 12px; padding: 6px 4px 6px 12px; font-size: 13px; --lv: var(--info-color, #039be5); background: color-mix(in srgb, var(--lv) var(--hfb-alert-tint, 12%), transparent); color: var(--lv); }
.alert.success { --lv: var(--success-color, #1e7a46); } .alert.warning { --lv: var(--warning-color, #b45309); } .alert.error { --lv: var(--error-color, #b42318); }
.alert svg { flex: none; } .alert span { flex: 1; }
.x { border: 0; background: transparent; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; color: inherit; }
.seg { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 4px; background: var(--hfb-seg-track, var(--secondary-background-color, #f0f2f5)); border-radius: 12px; }
.seg button { height: 34px; border: 0; border-radius: 9px; background: transparent; font-size: 13px; font-weight: 500; color: var(--c-text2); display: flex; align-items: center; justify-content: center; gap: 6px; }
.seg button.on { background: var(--hfb-seg-on, var(--card-background-color, #fff)); color: var(--hfb-seg-on-color, var(--primary-text-color, #1c2128)); font-weight: 600; box-shadow: var(--hfb-seg-on-shadow, none); }
.soft { background: var(--c-fill); border-radius: 14px; }
.panel.soft, .vd-target.soft, .fld.soft { background: var(--c-tile-bg); border: var(--c-tile-border); box-shadow: var(--c-tile-shadow); border-radius: var(--c-tile-radius); }
.panel { display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 14px; }
.facts { flex: 1; min-width: 0; display: flex; gap: 20px; }
.lbl { font-size: 11px; color: var(--c-text2); }
.v { font-size: 16px; font-weight: 700; } .v small { font-size: 12px; font-weight: 500; color: var(--c-text2); }
.applying { display: inline-flex; align-items: center; gap: 6px; }
.sb { height: 32px; border: 0; border-radius: 10px; background: var(--c-raised); box-shadow: var(--c-raised-sh); padding: 0 12px; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; flex: none; }
.sb:disabled { opacity: .6; cursor: default; }
.head2 { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; } .head2 .h { font-size: 15px; font-weight: 600; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.tile { padding: 10px 8px 8px 10px; display: flex; flex-direction: column; gap: 8px; background: var(--c-tile-bg); border: var(--c-tile-border); box-shadow: var(--c-tile-shadow); border-radius: var(--c-tile-radius); }
.tile.hot { background: var(--hfb-hot-tile, color-mix(in srgb, #E8592C 8%, var(--secondary-background-color, #f0f2f5))); }
.main { display: flex; align-items: center; gap: 8px; cursor: pointer; outline-offset: 2px; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
.name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.state { font-size: 12px; color: var(--c-text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.state.low { color: var(--c-err); font-weight: 600; }
.ctl { display: flex; align-items: center; gap: 4px; background: var(--c-card); border-radius: 12px; padding: 2px; }
.val { flex: 1; text-align: center; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.pm { width: 36px; height: 36px; border: 0; border-radius: 10px; background: transparent; display: flex; align-items: center; justify-content: center; }
.pm:disabled { opacity: .4; cursor: default; }
.tile.off .dim { opacity: .5; filter: grayscale(1); }
.badge { position: absolute; right: -4px; bottom: -4px; width: 18px; height: 18px; border-radius: 50%; background: var(--c-err); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px var(--c-fill); }
.flame { transform-origin: 50% 90%; animation: flame 1.4s ease-in-out infinite; }
@keyframes flame { 0%, 100% { transform: scale(1, 1) skewX(0); filter: brightness(1); } 25% { transform: scale(.94, 1.08) skewX(-3deg); filter: brightness(1.15); } 50% { transform: scale(1.04, .95) skewX(2deg); } 75% { transform: scale(.97, 1.05) skewX(-1deg); filter: brightness(1.1); } }
.blink { animation: blink 1.6s ease-in-out infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .flame, .blink, .spin { animation: none; } }
dialog { border: 0; border-radius: 24px; padding: 0; width: min(560px, 94vw); max-height: 90vh; background: var(--c-card); color: var(--c-text); }
dialog::backdrop { background: rgba(0, 0, 0, .4); }
.dlg-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 0 20px; font-size: 18px; font-weight: 500; }
.dlg-body { padding: 8px 12px 16px; }
.dlg-head .x { width: 40px; height: 40px; }
dialog.vd { width: min(480px, 94vw); overflow: auto; outline: none; }
dialog.vd[open] { display: flex; flex-direction: column; gap: 14px; padding: 18px 20px 20px; }
.vd-head { display: flex; align-items: center; gap: 10px; }
.vd .s { display: contents; } .vd-head > .s { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.vd .dot.soft { background: var(--c-fill); }
.dot.winopen { background: var(--info-color, #0a84ff); color: #fff; }
.vd .x.big { width: 40px; height: 40px; border-radius: 12px; }
.vd-title { margin: 0; font-size: 18px; font-weight: 500; }
.vd-alert { padding: 10px 14px; align-items: flex-start; line-height: 1.45; }
.vd-alert svg { margin-top: 1px; } .vd-alert b { font-weight: 600; }
.vd-now { display: flex; align-items: flex-end; gap: 12px; } .vd-now > div { flex: 1; }
.hero { font-size: 40px; font-weight: 700; letter-spacing: -1px; font-variant-numeric: tabular-nums; }
.unit.big { font-size: 15px; }
.chip { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 8px; border-radius: 12px; font-size: 12px; font-weight: 600; background: var(--c-card); color: var(--c-text2); flex: none; }
.vd-now .chip { background: var(--c-fill); margin-bottom: 8px; }
.chip.low { background: color-mix(in srgb, var(--c-err) var(--hfb-alert-tint, 12%), transparent); color: var(--c-err); }
.vd-target { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 14px; } .vd-target > .tvw { flex: 1; }
.vd-target.off > .tvw { opacity: .6; }
.tv { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; } .tv small { font-size: 13px; font-weight: 500; color: var(--c-text2); }
.pm.raised { background: var(--c-raised); box-shadow: var(--c-raised-sh); } .pm.raised:disabled { background: transparent; box-shadow: none; }
.vd-chart { margin: 0; } .vd-chart svg { display: block; }
.band { fill: color-mix(in srgb, var(--info-color, #0a84ff) var(--hfb-alert-tint, 12%), transparent); } .band-t { fill: var(--info-color, #0a84ff); }
.chart-msg { font-size: 12px; color: var(--c-text2); padding: 40px 0; text-align: center; }
.vd-h { font-size: 13px; font-weight: 600; margin-bottom: -6px; }
.vd-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.vd-tile { background: var(--c-tile-bg); border: var(--c-tile-border); box-shadow: var(--c-tile-shadow); border-radius: var(--c-tile-radius); padding: 10px 12px; }
.vd-tile .lbl { font-size: 12px; } .fv { font-size: 16px; font-weight: 600; margin-top: 2px; font-variant-numeric: tabular-nums; }
.vd-tile.low { background: color-mix(in srgb, var(--c-err) var(--hfb-alert-tint, 12%), transparent); } .vd-tile.low .fv { color: var(--c-err); }
.vd-wins { display: flex; flex-direction: column; gap: 6px; }
.vd-win { display: flex; align-items: center; gap: 10px; background: var(--c-tile-bg); border: var(--c-tile-border); box-shadow: var(--c-tile-shadow); border-radius: var(--hfb-tile-radius, 12px); padding: 8px 10px; }
.vd-win .dot.idle { background: var(--c-card); }
.wn { font-size: 13px; font-weight: 600; } .ws { font-size: 12px; color: var(--c-text2); } .ws.open { color: var(--info-color, #0a84ff); font-weight: 600; }
.vd-foot { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }
.sb.soft { background: var(--c-fill); box-shadow: none; font-weight: 600; }
.sb.primary { background: var(--hfb-btn-primary-bg, var(--primary-text-color, #1c2128)); color: var(--hfb-btn-primary-color, var(--card-background-color, #fff)); box-shadow: none; font-weight: 600; }
/* program dialog (V6-Program); dialog.gd is a dialog.vd, so it shares the sheet rules */
.dot.sm { width: 32px; height: 32px; }
.help { font-size: 12px; color: var(--c-text2); line-height: 1.4; } .prog-help { margin-top: -6px; }
.prog { display: flex; flex-direction: column; gap: 4px; padding: 4px; background: var(--hfb-seg-track, var(--secondary-background-color, #f0f2f5)); border-radius: 14px; }
.prog button { display: flex; align-items: center; gap: 12px; width: 100%; border: 0; border-radius: 11px; background: transparent; padding: 8px 10px; text-align: left; }
.prog button.on { background: var(--hfb-seg-on, var(--card-background-color, #fff)); box-shadow: var(--hfb-seg-on-shadow, none); }
.prog .n { display: block; font-size: 14px; font-weight: 600; } .prog .d { display: block; font-size: 12px; color: var(--c-text2); }
.prog .ck { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: none; color: transparent; }
.prog button.on .ck { background: var(--c-accent); color: var(--hfb-dot-on-icon, #fff); }
.fld { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 8px 8px 8px 14px; }
.fld .fl { flex: 1; min-width: 0; } .fld .t { font-size: 14px; font-weight: 600; } .fld .help { margin-top: 2px; }
.sw { width: 40px; height: 24px; border: 0; border-radius: 12px; padding: 0; margin-right: 6px; position: relative; flex: none; background: color-mix(in srgb, var(--c-text2) 35%, transparent); }
.sw::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: var(--hfb-dot-on-icon, #fff); box-shadow: 0 1px 2px rgba(0, 0, 0, .25); }
.sw.on { background: var(--c-accent); } .sw.on::after { left: 19px; }
.seg.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.sel { max-width: 100%; margin-top: 2px; border: 0; border-radius: 10px; padding: 6px 8px; background: var(--c-card); color: var(--c-text); font: inherit; font-size: 14px; font-weight: 600; }
.vd-tile .cap { font-size: 12px; color: var(--c-text2); margin-top: 2px; }
/* settings dialog (V7-Settings*): every setting is a soft panel with an icon circle, label, value and − / + (or a native picker) */
.seg.four { grid-template-columns: repeat(4, minmax(0, 1fr)); } .seg.tabs button { padding: 0 4px; min-width: 0; overflow: hidden; white-space: nowrap; }
.fields { display: flex; flex-direction: column; gap: 8px; } .pair { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.field { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 8px 8px 8px 8px; }
.field.soft { background: var(--c-tile-bg); border: var(--c-tile-border); box-shadow: var(--c-tile-shadow); border-radius: var(--c-tile-radius); }
.field .fl { flex: 1; min-width: 0; } .field .help { margin-top: 2px; }
.fi { width: 32px; height: 32px; border-radius: 50%; background: var(--hfb-dot-idle, var(--c-card)); color: #607D8B; display: flex; align-items: center; justify-content: center; flex: none; align-self: flex-start; margin-top: 2px; }
.fval { font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; } .fval.t { font-size: 14px; font-weight: 600; }
.pick { display: block; width: 100%; min-width: 0; margin: 0; padding: 0; border: 0; background: transparent; color: var(--c-text); font: inherit; font-size: 14px; font-weight: 600; text-overflow: ellipsis; appearance: none; -webkit-appearance: none; }
.go { width: 28px; height: 36px; display: flex; align-items: center; justify-content: center; color: var(--c-text2); flex: none; }
.phase { margin: 0; display: flex; flex-direction: column; gap: 6px; } .phase .ph { display: flex; gap: 3px; }
.phase .ph div { height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; white-space: nowrap; overflow: hidden; color: var(--hfb-dot-on-icon, #fff); }
.p-fast { flex: 2; background: var(--hfb-hot-dot, linear-gradient(145deg, #FF7A38, #CF3416)); } .p-heat { flex: 4; background: var(--hfb-heat-dot, linear-gradient(145deg, #FFA66E, #E8592C)); }
.p-run { flex: 2; background: var(--hfb-run-dot, linear-gradient(145deg, color-mix(in srgb, var(--primary-color, #4f6b8c) 65%, #fff), var(--primary-color, #4f6b8c))); }
.phase .ph .p-chk { flex: 2; background: var(--c-fill); color: #607D8B; }
.phase .cap { display: flex; justify-content: space-between; font-size: 11px; color: var(--c-text2); margin: 0; }
.ws .open { color: var(--info-color, #0a84ff); font-weight: 600; } .cnt { font-size: 12px; font-weight: 600; color: var(--c-text2); }
.vd-tile .li { display: inline-flex; vertical-align: -3px; margin-right: 4px; color: #607D8B; } .fv.s { font-size: 14px; }
@media (max-width: 599px) {
  dialog.vd { width: 100%; max-width: 100%; margin: auto 0 0; border-radius: 24px 24px 0 0; max-height: 92vh; }
}
`;

class HeatingCard extends (globalThis.HTMLElement ?? class {}) {
  constructor() {
    super();
    this._g = null; // gesture in progress {valve, zone, main, timer, held}
    this._tap = null; // a tap waiting for a possible double tap {key, timer}
    this._pending = {}; // ± targets sent, not yet in hass: climate -> {t, at}
    this._seen = null; // the watched states of the last render
    this._last = {}; // the last html of each patched part
    this._pressed = false; // a pointer is down: renders wait
    this._dirty = false;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `<style>${STYLE}</style><div class="wrap" style="display:contents"></div><dialog aria-label="Rozvrh"></dialog><dialog class="vd" aria-label="Detail hlavice"></dialog><dialog class="vd gd"></dialog>`;
    this._wrap = this.shadowRoot.querySelector('.wrap');
    this._dlg = this.shadowRoot.querySelector('dialog:not(.vd)');
    this._vdlg = this.shadowRoot.querySelector('dialog.vd:not(.gd)');
    this._gdlg = this.shadowRoot.querySelector('dialog.gd');
    this._gd = null; // the generic dialog's kind (a DIALOGS key) while it is open
    this._gdCtx = { calendars: [], pending: null, nums: {}, sources: [], tab: 'rule' };
    this._vd = null; // the valve whose dialog is open
    this._chart = null; // chartModel() result, 'none' or null (loading)
    this._seq = 0; // drops stale history responses
    const root = this.shadowRoot;
    root.addEventListener('click', (e) => this._onClick(e));
    root.addEventListener('pointerdown', (e) => this._down(e));
    root.addEventListener('pointerup', () => this._up());
    root.addEventListener('pointercancel', () => { this._cancel(); this._release(); });
    root.addEventListener('lostpointercapture', () => this._cancel());
    root.addEventListener('pointerout', (e) => { // the pointer left the pressed tile
      const g = this._g;
      if (g && !g.main.contains(e.relatedTarget)) this._cancel();
    });
    root.addEventListener('keydown', (e) => this._key(e));
    // an open select must not be rebuilt: renders wait until it changes or loses focus
    // (every select / time input of the generic dialogs: the holiday calendar, the settings pickers)
    const PICKER = '[data-act="calendar"], [data-act="pick"]';
    root.addEventListener('focusin', (e) => { if (e.target.closest?.(PICKER)) this._selOpen = true; });
    root.addEventListener('focusout', (e) => { if (e.target.closest?.(PICKER)) { this._selOpen = false; this._flushGeneric(); } });
    root.addEventListener('change', (e) => { // the holiday calendar select, the settings pickers
      const sel = e.target.closest?.(PICKER);
      if (!sel) return;
      this._selOpen = false;
      setTimeout(() => this._flushGeneric(), 0);
      if (!this._cfg) return;
      if (sel.dataset.act === 'calendar') this._call('input_text', 'set_value', { entity_id: eid(this._cfg, ...HOLIDAY_ID), value: sel.value });
      else this._pick(sel.dataset.id, sel.value);
    });
    this._dlg.addEventListener('close', () => { this._dlg.replaceChildren(); this._sched = null; });
    // a click outside the sheet's box closes it (padding and gaps are inside the box)
    for (const dlg of [this._dlg, this._vdlg, this._gdlg]) {
      dlg.addEventListener('click', (e) => {
        if (e.target !== dlg) return;
        const r = dlg.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
      });
    }
    this._vdlg.addEventListener('close', () => {
      if (this._vdlg.open) return; // reopened before this event ran
      clearInterval(this._vt);
      this._seq++;
      this._vd = null;
      this._vdIds = null;
      this._vdSeen = null;
      this._vdlg.replaceChildren();
    });
    this._gdlg.addEventListener('close', () => {
      if (this._gdlg.open) return;
      clearInterval(this._gt);
      clearTimeout(this._gpt);
      this._gd = null;
      this._gdSeen = null;
      this._gdDirty = false;
      this._selOpen = false;
      this._gdlg.replaceChildren();
    });
  }

  // Timers and dialogs end with the element (a dashboard edit or navigation removes it); nothing is restored on reconnect.
  disconnectedCallback() {
    clearInterval(this._vt);
    clearInterval(this._gt);
    clearTimeout(this._gpt);
    clearTimeout(this._pt);
    this._cancel();
    clearTimeout(this._tap?.timer);
    this._tap = null;
    this._seq++;
    if (this._vdlg.open) this._vdlg.close();
    if (this._gdlg.open) this._gdlg.close();
    if (this._dlg.open) this._dlg.close();
  }

  static getStubConfig() {
    return { circuit: 'heating_circuit_1', valves: ['climate.living_room_valve'] };
  }

  setConfig(config) {
    this._cfg = normalizeConfig(config);
    this._zones = gestureMap(this._cfg);
    this._ids = watchedIds(this._cfg);
    this._seen = null;
    this._built = false;
    if (this._hass) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._sched) this._sched.hass = hass;
    this._refreshGeneric();
    this._refreshDialog(); // the dialog also reads the valve's device entities and the windows' batteries
    if (!this._cfg) return;
    const next = this._ids.map((id) => hass.states?.[id]);
    if (this._seen && next.every((s, i) => s === this._seen[i])) return; // nothing the card shows changed
    this._request();
  }

  getCardSize() {
    return 8;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  // While a pointer is down the render waits (a rebuilt tile would swallow the press).
  _request() {
    if (this._pressed) this._dirty = true;
    else this._render();
  }

  _release() {
    this._pressed = false;
    if (this._dirty || this._gdDirty) setTimeout(() => { // after the click
      if (this._pressed) return;
      if (this._dirty) { this._dirty = false; this._render(); }
      this._flushGeneric();
    }, 0);
  }

  // A generic-dialog render that waited for a pointer or the open select.
  _flushGeneric() {
    if (this._gdDirty && !this._pressed && !this._selOpen) { this._gdDirty = false; this._refreshGeneric(true); }
  }

  // Patches only the parts whose markup changed (the flame / blink of the other tiles keeps running)
  // and gives the focus back to the same control.
  _set(el, html, key) {
    if (this._last[key] === html) return;
    this._last[key] = html;
    const k = el.contains(this.shadowRoot.activeElement) ? this.shadowRoot.activeElement.dataset?.k : null;
    el.innerHTML = html;
    if (k) el.querySelector(`[data-k="${CSS.escape(k)}"]`)?.focus();
  }

  _render() {
    const now = Date.now();
    for (const [climate, p] of Object.entries(this._pending)) {
      if (now - p.at >= PENDING_MS || num(this._hass.states?.[climate]?.attributes?.temperature) === p.t) delete this._pending[climate];
    }
    this._seen = this._ids.map((id) => this._hass.states?.[id]);
    const parts = cardParts(this._hass, this._cfg, this._pending);
    if (!this._built) {
      this._wrap.innerHTML = `<div class="card" data-p="box1"></div><div class="card"><div class="head2"><div class="h">Hlavice</div><div class="sub" data-p="sum"></div></div><div class="grid">${
        this._cfg.valves.map((v) => `<div class="tw" data-v="${esc(v)}"></div>`).join('')}</div></div>`;
      this._last = {};
      this._built = true;
    }
    this._set(this._wrap.querySelector('[data-p="box1"]'), parts.box1, 'box1');
    this._set(this._wrap.querySelector('[data-p="sum"]'), esc(parts.summary), 'sum');
    this._wrap.querySelectorAll('.tw').forEach((el, i) => this._set(el, parts.tiles[i], `t${i}`));
    this._refreshDialog(true);
  }

  _refreshDialog(force = false, first = false) {
    if (!this._vd || !this._vdlg.open || !this._cfg || !this._hass) return;
    if (this._pressed && !first) { this._dirty = true; return; } // like the card: a rebuilt button would swallow the press
    // only when something the dialog reads changed (identity of the state objects)
    const hass = this._hass, climate = this._vd;
    const watch = [...this._ids, ...this._vdIds, eid(this._cfg, 'input_number', 'heating_window_reminder'), 'input_number.heating_low_battery_threshold',
      ...windowList(hass, this._cfg, climate).flatMap((w) => [w.entity_id, w.battery])].filter(Boolean);
    const next = watch.map((id) => hass.states?.[id]);
    if (!force && this._vdSeen && this._vdSeen.length === next.length && next.every((x, i) => x === this._vdSeen[i])) return;
    this._vdSeen = next;
    const d = valveDetail(hass, this._cfg, climate, Date.now(), this._vdIds);
    const p = this._pending[climate];
    if (p) d.view = { ...d.view, target: p.t };
    const parts = detailParts(d, this._chart ?? 'loading');
    if (!this._vdlg.firstElementChild) this._vdlg.innerHTML = detailShell({}, climate);
    for (const [k, html] of Object.entries(parts)) this._set(this._vdlg.querySelector(`[data-p="${k}"]`), html, `vd:${k}`);
    this._vdlg.querySelectorAll('[data-act="step"]').forEach((b) => { b.disabled = d.view.off; });
    this._vdlg.querySelector('.vd-target').classList.toggle('off', d.view.phase === 'window');
  }

  // The generic dialog (program, settings; stats later): head + body patched only when a watched state changed.
  _refreshGeneric(force = false, first = false) {
    const def = DIALOGS[this._gd];
    if (!def || !this._gdlg.open || !this._cfg || !this._hass) return;
    // a rebuilt button would swallow the press, a rebuilt select closes its open picker
    if ((this._pressed || this._selOpen) && !first) { this._gdDirty = true; return; }
    const hass = this._hass;
    const pp = this._gdCtx.pending; // a tapped program is dropped once hass reports it or after PENDING_MS
    if (pp && (Date.now() - pp.at >= PENDING_MS || programId(hass, this._cfg) === pp.id)) this._gdCtx.pending = null;
    for (const [id, p] of Object.entries(this._gdCtx.nums)) { // so is a ± setting value
      if (Date.now() - p.at >= PENDING_MS || num(st(hass, id)) === p.v) delete this._gdCtx.nums[id];
    }
    this._gdDirty = false;
    const next = def.ids(hass, this._cfg, this._gdCtx).map((id) => hass.states?.[id]);
    if (!force && this._gdSeen && this._gdSeen.length === next.length && next.every((x, i) => x === this._gdSeen[i])) return;
    this._gdSeen = next;
    if (!this._gdlg.firstElementChild) this._gdlg.innerHTML = gdShell;
    const parts = def.parts(hass, this._cfg, this._gdCtx);
    for (const [k, html] of Object.entries(parts)) this._set(this._gdlg.querySelector(`[data-p="${k}"]`), html, `gd:${k}`);
  }

  _openDialog(kind) {
    if (!DIALOGS[kind]) return;
    this._gd = kind;
    this._gdSeen = null;
    this._gdDirty = false;
    this._selOpen = false;
    // the calendar.* ids and the outdoor temperature sources are resolved once; the dialog re-reads only their states
    this._gdCtx = {
      calendars: Object.keys(this._hass.states ?? {}).filter((id) => id.startsWith('calendar.')), pending: null,
      nums: {}, sources: outdoorSources(this._hass), tab: 'rule',
    };
    this._gdlg.setAttribute('aria-label', DIALOGS[kind].label);
    clearInterval(this._gt);
    this._gt = setInterval(() => this._refreshGeneric(true), 60000); // "dnes" / "včera" roll over at midnight
    for (const k of Object.keys(this._last)) if (k.startsWith('gd:')) delete this._last[k];
    this._gdlg.replaceChildren();
    if (!this._gdlg.open) this._gdlg.showModal();
    this._refreshGeneric(true, true);
  }

  _openValve(climate) {
    this._vd = climate;
    this._chart = null;
    this._vdIds = deviceEntities(this._hass, climate); // resolved once; the dialog re-reads only their states
    this._vdSeen = null;
    for (const k of Object.keys(this._last)) if (k.startsWith('vd:')) delete this._last[k];
    this._vdlg.replaceChildren();
    if (!this._vdlg.open) this._vdlg.showModal();
    this._refreshDialog(true, true);
    this._loadChart();
    clearInterval(this._vt);
    let n = 0; // every minute: the minutes a window has been open; every 5th: the history
    this._vt = setInterval(() => { if (++n % 5 === 0) this._loadChart(); else this._refreshDialog(true); }, 60000);
  }

  // 24 h of the valve's temperatures and its window sensors; any failure leaves the chart out.
  async _loadChart() {
    const climate = this._vd;
    const seq = ++this._seq;
    const end = Date.now();
    let chart = 'none';
    try {
      const wl = windowList(this._hass, this._cfg, climate);
      const res = await this._hass.callWS({
        type: 'history/history_during_period', start_time: new Date(end - 24 * 3600000).toISOString(), end_time: new Date(end).toISOString(),
        entity_ids: [climate, ...wl.map((w) => w.entity_id)], include_start_time_state: true, significant_changes_only: false, minimal_response: false, no_attributes: false,
      });
      chart = chartModel(res?.[climate], wl.map((w) => ({ rows: res?.[w.entity_id], since: w.open === true || w.state === 'on' ? sinceMs(w) : null })), end) ?? 'none';
    } catch (e) { /* no history: the chart shows a note */ }
    if (seq !== this._seq || climate !== this._vd) return;
    this._chart = chart;
    this._refreshDialog(true);
  }

  _call(domain, service, data) {
    return Promise.resolve(this._hass.callService(domain, service, data)).catch((e) => console.warn(`heating-card: ${domain}.${service} failed`, e));
  }

  // A settings picker: the outdoor temperature source (input_text) or a rule time (input_datetime, HH:MM).
  _pick(id, value) {
    if (id.startsWith('input_text.') && value) this._call('input_text', 'set_value', { entity_id: id, value });
    else if (id.startsWith('input_datetime.') && /^\d\d:\d\d$/.test(value)) this._call('input_datetime', 'set_datetime', { entity_id: id, time: `${value}:00` });
  }

  _onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const c = this._cfg;
    const act = b.dataset.act;
    if (act === 'mode') this._call('input_select', 'select_option', { entity_id: eid(c, 'input_select', 'heating_mode'), option: b.dataset.val });
    else if (act === 'clear') this._call('input_text', 'set_value', { entity_id: eid(c, 'input_text', 'heating_status'), value: '' });
    else if (act === 'close') this._vdlg.close();
    else if (act === 'gclose') this._gdlg.close();
    else if (act === 'open') this._openDialog(b.dataset.val);
    else if (act === 'program') {
      // quick taps: the pending program counts as current until hass reports it (or PENDING_MS)
      const pp = this._gdCtx.pending;
      const cur = pp && Date.now() - pp.at < PENDING_MS ? pp.id : programId(this._hass, c);
      if (cur === b.dataset.val) return;
      this._gdCtx.pending = { id: b.dataset.val, at: Date.now() };
      this._call('select', 'select_option', { entity_id: eid(c, 'select', 'heating_program'), option: b.dataset.val });
      clearTimeout(this._gpt);
      this._gpt = setTimeout(() => { this._gdCtx.pending = null; this._refreshGeneric(true); }, PENDING_MS + 50);
      this._refreshGeneric(true);
    } else if (act === 'alternation') this._call('input_boolean', 'toggle', { entity_id: eid(c, 'input_boolean', 'heating_week_alternation') });
    else if (act === 'holidays') {
      if (st(this._hass, eid(c, 'input_select', 'heating_holidays')) !== b.dataset.val) this._call('input_select', 'select_option', { entity_id: eid(c, 'input_select', 'heating_holidays'), option: b.dataset.val });
    } else if (act === 'tab') { this._gdCtx.tab = b.dataset.val; this._refreshGeneric(true); }
    else if (act === 'rule') {
      if (st(this._hass, eid(c, 'input_select', 'heating_auto_rule')) !== b.dataset.val) this._call('input_select', 'select_option', { entity_id: eid(c, 'input_select', 'heating_auto_rule'), option: b.dataset.val });
    } else if (act === 'num') {
      if (!b.dataset.id.startsWith('input_number.')) return;
      // quick taps add up: the next step starts from the last value sent, until hass reports it
      const f = numField(this._hass, b.dataset.id, {}, this._gdCtx.nums);
      if (!f) return;
      const v = stepNum(f, Number(b.dataset.d));
      if (v === f.value) return;
      this._gdCtx.nums[f.id] = { v, at: Date.now() };
      this._call('input_number', 'set_value', { entity_id: f.id, value: v });
      clearTimeout(this._gpt);
      this._gpt = setTimeout(() => this._refreshGeneric(true), PENDING_MS + 50);
      this._refreshGeneric(true);
    } else if (act === 'programs') { this._gdlg.close(); this._openSchedule(c.valves[0]); }
    else if (act === 'history') { const id = this._vd; this._vdlg.close(); this._moreInfo(id); } // HA's dialog would sit under ours
    else if (act === 'schedule') { const id = this._vd; this._vdlg.close(); this._openSchedule(id); }
    else if (act === 'calibrate') {
      if (globalThis.confirm('Kalibrovat hlavici? Ventil se na chvíli úplně otevře a zavře.')) this._call('script', `heating_calibrate_${c.circuit}`, { climate: this._vd });
    } else if (act === 'sync') this._call('input_button', 'press', { entity_id: eid(c, 'input_button', 'heating_sync') });
    else if (act === 'step') {
      const v = valveView(this._hass, c, b.dataset.valve);
      if (v.off) return;
      // quick taps add up: the next step starts from the last value sent, until hass reports it
      const t = nextTarget(v, this._pending, Number(b.dataset.d));
      if (t == null) return;
      this._pending[v.climate] = { t, at: Date.now() };
      this._call('climate', 'set_temperature', { entity_id: v.climate, temperature: t });
      clearTimeout(this._pt);
      this._pt = setTimeout(() => this._request(), PENDING_MS + 50);
      this._render();
    }
  }

  // Gestures on a tile: tap / double tap / hold on the body or the icon circle.
  _down(e) {
    this._pressed = true;
    clearTimeout(this._g?.timer);
    this._g = null;
    const main = e.target.closest('.main');
    if (!main || e.button > 0) return;
    const zone = e.target.closest('[data-zone="icon"]') ? 'icon' : 'body';
    const g = { valve: main.dataset.valve, zone, main, held: false };
    const h = zoneHandlers(this._zones, zone);
    if (h.hold) g.timer = setTimeout(() => { g.held = true; this._run(h.hold, g.valve); }, HOLD_MS);
    this._g = g;
  }

  _cancel() {
    if (this._g) clearTimeout(this._g.timer);
    this._g = null;
  }

  _up() {
    const g = this._g;
    this._cancel();
    this._release();
    if (!g || g.held) return;
    const h = zoneHandlers(this._zones, g.zone);
    const key = `${g.valve}|${g.zone}`;
    if (this._tap && this._tap.key === key && h.double_tap) { // second tap in time
      clearTimeout(this._tap.timer);
      this._tap = null;
      this._run(h.double_tap, g.valve);
    } else if (h.double_tap) { // wait to see whether a second tap follows
      clearTimeout(this._tap?.timer);
      this._tap = { key, timer: setTimeout(() => { this._tap = null; if (h.tap) this._run(h.tap, g.valve); }, DOUBLE_MS) };
    } else if (h.tap) this._run(h.tap, g.valve);
  }

  // Enter / Space: the tile's text runs the schedule action, the icon button the info action,
  // whatever gesture they are mapped to (only when not `none`).
  _key(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest?.('[data-zone]');
    const valve = e.target.closest?.('.main')?.dataset.valve;
    if (!el || !valve) return;
    const c = this._cfg;
    const action = el.dataset.zone === 'icon' ? (c.info_gesture !== 'none' && 'info') : (c.schedule_gesture !== 'none' && 'schedule');
    if (!action) return;
    e.preventDefault();
    this._run(action, valve);
  }

  _run(action, climate) {
    if (action === 'info') this._openValve(climate);
    else this._openSchedule(climate);
  }

  _moreInfo(climate) {
    this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: climate }, bubbles: true, composed: true }));
  }

  // The schedule card in a simple dialog.
  _openSchedule(climate) {
    const c = this._cfg;
    const body = document.createElement('div');
    body.className = 'dlg-body';
    if (customElements.get('heating-schedule-card')) {
      const el = document.createElement('heating-schedule-card');
      el.setConfig({ valve: climate, circuits: [{ id: c.circuit, valves: c.valves }], time_step: 15 });
      el.hass = this._hass;
      this._sched = el;
      body.append(el);
    } else body.textContent = 'Karta heating-schedule-card není nainstalovaná.';
    const head = document.createElement('div');
    head.className = 'dlg-head';
    head.innerHTML = `<span>Rozvrh</span><button class="x" aria-label="Zavřít">${stroke('M6 6l12 12M18 6 6 18', 20)}</button>`;
    head.querySelector('button').addEventListener('click', () => this._dlg.close());
    this._dlg.replaceChildren(head, body);
    this._dlg.showModal();
  }
}

if (globalThis.customElements && !customElements.get('heating-card')) {
  customElements.define('heating-card', HeatingCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'heating-card', name: 'Heating Card', description: 'One heating circuit: mode, program and valves (Homecraft look).' });
  console.info(`%c HEATING-CARD %c ${VERSION} `, 'color:#fff;background:#E8592C', '');
}

export { HeatingCard, VERSION };
