import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  // 暫時禁用 StrictMode 來減少開發環境的重複連接
  // <StrictMode>
    <App />
  // </StrictMode>
)