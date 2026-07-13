import type { ThemeConfig } from 'antd'
import { theme as antdTheme } from 'antd'

/** Shared brand colors aligned with existing CSS custom properties. */
export const brandColors = {
  navy: '#102a43',
  blue: '#315d9a',
  teal: '#167d83',
  tealSoft: '#e2f1ef',
  border: '#dbe4ea',
  muted: '#6b7c8f',
  surface: '#ffffff',
  danger: '#b8453e',
  warning: '#b27615',
  appBg: '#eef3f7',
  appText: '#243b53',
  success: '#247049',
} as const

export const brandColorsDark = {
  navy: '#ececec',
  blue: '#7eb0e8',
  teal: '#4ec5cb',
  tealSoft: '#1a3335',
  border: '#2f2f2f',
  muted: '#9b9b9b',
  surface: '#1a1a1a',
  danger: '#e07a72',
  warning: '#e0b35c',
  appBg: '#0b0d12',
  appText: '#ececec',
  success: '#5ecf8e',
} as const

const fontFamily = "'DM Sans', system-ui, -apple-system, sans-serif"

function buildToken(colors: typeof brandColors | typeof brandColorsDark) {
  return {
    colorPrimary: colors.teal,
    colorInfo: colors.blue,
    colorSuccess: colors.success,
    colorWarning: colors.warning,
    colorError: colors.danger,
    colorTextBase: colors.appText,
    colorBgBase: colors.appBg,
    colorBgContainer: colors.surface,
    colorBorder: colors.border,
    colorTextSecondary: colors.muted,
    borderRadius: 10,
    fontFamily,
    fontSize: 15,
    controlHeight: 40,
    wireframe: false,
  }
}

export function createAntTheme(mode: 'light' | 'dark'): ThemeConfig {
  const colors = mode === 'dark' ? brandColorsDark : brandColors

  return {
    algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: buildToken(colors),
    components: {
      Button: {
        borderRadius: 10,
        controlHeight: 40,
        fontWeight: 600,
        fontSize: 15,
      },
      Input: {
        borderRadius: 10,
        controlHeight: 40,
        fontSize: 15,
      },
      Select: {
        borderRadius: 10,
        controlHeight: 40,
        fontSize: 15,
        optionFontSize: 15,
        zIndexPopup: 1200,
      },
      Card: {
        borderRadiusLG: 14,
      },
      Layout: {
        bodyBg: colors.appBg,
        headerBg: colors.surface,
        siderBg: mode === 'dark' ? '#171717' : '#f7f7f8',
      },
      Menu: {
        itemBorderRadius: 8,
        itemMarginInline: 8,
        fontSize: 15,
      },
      Table: {
        headerBg: mode === 'dark' ? '#222' : '#f5f8fa',
        borderColor: colors.border,
        fontSize: 14,
      },
      Modal: {
        borderRadiusLG: 14,
      },
      Drawer: {
        paddingLG: 20,
        zIndexPopup: 1100,
      },
      Message: {
        contentBg: colors.surface,
        contentPadding: '10px 14px',
        fontSize: 15,
        zIndexPopup: 1400,
      },
      Notification: {
        zIndexPopup: 1400,
      },
      Tag: {
        borderRadiusSM: 999,
      },
    },
  }
}
