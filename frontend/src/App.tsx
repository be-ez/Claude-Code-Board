import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout/Layout';
import { SplitView } from './components/Layout/SplitView';
import { CreateSessionModal } from './components/Session/CreateSessionModal';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { useWebSocket } from './hooks/useWebSocket';
import { useNotifications } from './hooks/useNotifications';
import { SessionsProvider } from './contexts/SessionsContext';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { LoginPage } from './components/Auth/LoginPage';
import { WorkflowStages } from './pages/WorkflowStages';
import { WorkItemListPage } from './pages/WorkItemListPage';
import { WorkItemDetailPage } from './pages/WorkItemDetailPage';
import AgentPromptsPage from './pages/AgentPromptsPage';
import AgentPromptDetailPage from './pages/AgentPromptDetailPage';
import { GlassDemo } from './pages/GlassDemo';
import { useTranslation } from 'react-i18next';

function App() {
  const { t } = useTranslation();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { isConnected, connectionError } = useWebSocket();
  
  // 啟用全域通知系統
  useNotifications();
  
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
        <AuthProvider>
          <div className="min-h-screen bg-gray-50 relative">
            <Routes>
                {/* 登入頁面 */}
                <Route path="/login" element={<LoginPage />} />
                
                {/* 受保護的路由 */}
                <Route path="/*" element={
                  <ProtectedRoute>
                    <SessionsProvider>
                      {/* WebSocket 連線狀態提示 - 固定在頂部 */}
                      {!isConnected && (
                        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-50 border-b border-yellow-400 p-4">
                          <div className="flex items-center justify-center">
                            <div className="flex-shrink-0">
                              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm text-yellow-700">
                                {connectionError ? t('app.connectionError', { message: connectionError.message }) : t('app.connecting')}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <Layout onCreateSession={() => setIsCreateModalOpen(true)}>
                        <ErrorBoundary>
                          <Routes>
                            <Route path="/" element={<SplitView onCreateSession={() => setIsCreateModalOpen(true)} />} />
                            <Route path="/sessions/:sessionId" element={<SplitView onCreateSession={() => setIsCreateModalOpen(true)} />} />
                            <Route path="/workflow-stages" element={<WorkflowStages />} />
                            <Route path="/work-items" element={<WorkItemListPage />} />
                            <Route path="/work-items/:id" element={<WorkItemDetailPage />} />
                            <Route path="/agent-prompts" element={<AgentPromptsPage />} />
                            <Route path="/agent-prompts/:name" element={<AgentPromptDetailPage />} />
                            <Route path="/glass-demo" element={<GlassDemo />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                          </Routes>
                        </ErrorBoundary>

                        {/* 建立 Session Modal */}
                        <CreateSessionModal
                          isOpen={isCreateModalOpen}
                          onClose={() => setIsCreateModalOpen(false)}
                        />
                      </Layout>
                    </SessionsProvider>
                  </ProtectedRoute>
                } />
              </Routes>

              {/* Toast 通知 */}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#363636',
                    color: '#fff',
                  },
                }}
              />
            </div>
        </AuthProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;