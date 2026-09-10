import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Copy, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AgentDetail {
  name: string;
  fileName: string;
  content: string;
  description?: string;
  tools?: string[];
}

const AgentPromptDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (name) {
      loadAgentDetail(name);
    }
  }, [name]);

  const loadAgentDetail = async (agentName: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/agent-prompts/${agentName}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAgent(data);
      } else if (response.status === 404) {
        // Agent 不存在
        setAgent(null);
      }
    } catch (error) {
      console.error('Failed to load agent detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyContent = () => {
    if (agent?.content) {
      navigator.clipboard.writeText(agent.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleBack = () => {
    navigate('/agent-prompts');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">{t('common.loading')}</div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 rounded-lg p-8 text-center">
          <p className="text-red-600 mb-4">{t('agentPrompts.notFound', { name })}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            {t('splitView.backToList')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* 頁面標題和操作 */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title={t('splitView.backToList')}
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {agent.name}
              </h1>
              <p className="text-sm text-gray-500">{agent.fileName}</p>
            </div>
          </div>
          
          <button
            onClick={handleCopyContent}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            {copied ? (
              <>
                <CheckCircle className="h-4 w-4" />
                <span>{t('agentPrompts.copied')}</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span>{t('agentPrompts.copyContent')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Agent 資訊 */}
      {(agent.description || agent.tools) && (
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          {agent.description && (
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">{t('common.description')}</h3>
              <p className="text-gray-600">{agent.description}</p>
            </div>
          )}
          
          {agent.tools && agent.tools.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">{t('messageItem.tool')}</h3>
              <div className="flex flex-wrap gap-2">
                {agent.tools.map((tool, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Markdown 內容 */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b px-4 py-3">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-gray-500" />
            <h2 className="font-semibold text-gray-900">{t('agentPrompts.promptContent')}</h2>
          </div>
        </div>
        
        <div className="p-4">
          <pre className="bg-gray-50 rounded p-4 overflow-x-auto">
            <code className="text-sm text-gray-800 whitespace-pre-wrap">
              {agent.content}
            </code>
          </pre>
        </div>
      </div>

      {/* 操作按鈕 */}
      <div className="mt-6 flex justify-end space-x-3">
        <button
          onClick={handleBack}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
        >
          {t('splitView.backToList')}
        </button>
        <button
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          onClick={() => {
            // TODO: 實作套用到工作流程的功能
            alert(t('agentPrompts.applyNotImplemented'));
          }}
        >
          {t('agentPrompts.applyToWorkflow')}
        </button>
      </div>
    </div>
  );
};

export default AgentPromptDetailPage;