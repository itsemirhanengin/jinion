import { createContext, useContext } from 'react';
import { darkTheme, type Theme } from '../theme/themes.js';

export const ThemeContext = createContext<Theme>(darkTheme);

export const useTheme = () => useContext(ThemeContext);
