import { ConfigProvider, App as AntApp } from 'antd'
import type { ReactNode } from 'react'

import { useTheme } from '../hooks/useTheme'
import { createAntTheme } from './tokens'

import 'antd/dist/reset.css'
import '../styles/antd-overrides.css'

export function AntDesignProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme()
  const antdTheme = createAntTheme(theme)
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <ConfigProvider theme={antdTheme} wave={{ disabled: reduceMotion }}>
      <AntApp className="gxp-antd-app" message={{ top: 64 }}>
        {children}
      </AntApp>
    </ConfigProvider>
  )
}
