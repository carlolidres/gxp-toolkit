export {
  APP_NAME,
  APP_TAGLINE,
  VRMS_MENU_TOOLTIP,
  vrmsRouteLabels,
  vrmsSidebarMenu,
  isVrmsPath,
  resolveWorkspaceTitle,
} from './navigationRegistry'

export type { PermissionAction, NavMenuDefinition, NavGroupDefinition } from './navigationRegistry'
export { PERMISSION_ACTIONS, PERMISSION_ACTION_LABELS, navigationRegistry, getAllNavMenus, getMenuById, getMenuByPath, toSidebarItems } from './navigationRegistry'
