import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Workflow,
  ListTodo,
  Palette,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { workflowStageService, WorkflowStage } from '../services/workflowStageService';
import { agentPromptService, AgentListItem } from '../services/agentPromptService';
import toast from 'react-hot-toast';
import { Trans, useTranslation } from 'react-i18next';

export const WorkflowStages: React.FC = () => {
  const { t } = useTranslation();
  const [stages, setStages] = useState<WorkflowStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<Partial<WorkflowStage>>({});
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  
  // Agent 相關狀態
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [promptSource, setPromptSource] = useState<'custom' | 'agent'>('custom');
  const [agentError, setAgentError] = useState<string>('');
  const [isAgentConfigured, setIsAgentConfigured] = useState(false);

  useEffect(() => {
    loadStages();
    loadAgentConfig();
  }, []);

  const loadAgentConfig = async () => {
    try {
      const config = await agentPromptService.getConfig();
      setIsAgentConfigured(config.configured);
      if (config.configured) {
        const agentList = await agentPromptService.listAgents();
        setAgents(agentList);
      }
    } catch (error) {
      console.error('Failed to load agent config:', error);
    }
  };

  const loadStages = async () => {
    try {
      setLoading(true);
      const data = await workflowStageService.getAllStages();
      setStages(data);
    } catch (error) {
      toast.error(t('workflowStage.loadFailed'));
      console.error('Failed to load workflow stages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    setPromptSource('custom');
    setAgentError('');
    setFormData({
      name: '',
      description: '',
      system_prompt: '',
      agent_ref: '',
      suggested_tasks: [],
      color: '#8B5CF6',
      icon: 'workflow',
      is_active: true
    });
  };

  const handleEdit = (stage: WorkflowStage) => {
    setEditingStage(stage.stage_id);
    setPromptSource(stage.agent_ref ? 'agent' : 'custom');
    setAgentError('');
    setFormData({
      ...stage,
      suggested_tasks: stage.suggested_tasks || []
    });
  };

  // Agent 驗證邏輯
  const validateAgent = async (agentName: string): Promise<boolean> => {
    if (!agentName) return true;
    
    try {
      const exists = await workflowStageService.checkAgentExists(agentName);
      if (!exists) {
        setAgentError(t('workflowStage.agentMissing', { name: agentName }));
        return false;
      }
      setAgentError('');
      return true;
    } catch (error) {
      setAgentError(t('workflowStage.agentValidateError'));
      return false;
    }
  };

  const handlePromptSourceChange = (source: 'custom' | 'agent') => {
    setPromptSource(source);
    setAgentError('');
    
    if (source === 'agent') {
      // 切換到 Agent 模式時，清空自訂提示詞，保留 agent_ref
      setFormData(prev => ({ 
        ...prev, 
        system_prompt: '' 
      }));
    } else {
      // 切換到自訂模式時，清空 agent_ref
      setFormData(prev => ({ 
        ...prev, 
        agent_ref: '' 
      }));
    }
  };

  const handleAgentChange = async (agentName: string) => {
    setFormData(prev => ({ ...prev, agent_ref: agentName }));
    
    if (agentName) {
      await validateAgent(agentName);
    } else {
      setAgentError('');
    }
  };

  const handleSave = async () => {
    try {
      if (isCreating) {
        // 驗證必要欄位
        if (!formData.name) {
          toast.error(t('workflowStage.nameRequired'));
          return;
        }

        // 根據提示詞來源驗證
        if (promptSource === 'custom') {
          if (!formData.system_prompt) {
            toast.error(t('workflowStage.promptRequired'));
            return;
          }
        } else {
          if (!formData.agent_ref) {
            toast.error(t('workflowStage.agentRequired'));
            return;
          }
          
          // 驗證 Agent 存在性
          const agentValid = await validateAgent(formData.agent_ref);
          if (!agentValid) {
            return;
          }
        }

        // 如果有 Agent 錯誤，阻止儲存
        if (agentError) {
          toast.error(t('workflowStage.fixAgentFirst'));
          return;
        }
        await workflowStageService.createStage({
          name: formData.name!,
          description: formData.description,
          system_prompt: promptSource === 'custom' ? formData.system_prompt! : '',
          agent_ref: promptSource === 'agent' ? formData.agent_ref : '',
          suggested_tasks: formData.suggested_tasks,
          color: formData.color,
          icon: formData.icon
        });
        toast.success(t('workflowStage.created'));
      } else if (editingStage) {
        // 同樣的驗證邏輯
        if (!formData.name) {
          toast.error(t('workflowStage.nameRequired'));
          return;
        }

        if (promptSource === 'custom') {
          if (!formData.system_prompt) {
            toast.error(t('workflowStage.promptRequired'));
            return;
          }
        } else {
          if (!formData.agent_ref) {
            toast.error(t('workflowStage.agentRequired'));
            return;
          }
          
          const agentValid = await validateAgent(formData.agent_ref);
          if (!agentValid) {
            return;
          }
        }

        if (agentError) {
          toast.error(t('workflowStage.fixAgentFirst'));
          return;
        }

        await workflowStageService.updateStage(editingStage, {
          name: formData.name,
          description: formData.description,
          system_prompt: promptSource === 'custom' ? formData.system_prompt! : '',
          agent_ref: promptSource === 'agent' ? formData.agent_ref : '',
          suggested_tasks: formData.suggested_tasks,
          color: formData.color,
          icon: formData.icon,
          is_active: formData.is_active
        });
        toast.success(t('workflowStage.updated'));
      }
      setIsCreating(false);
      setEditingStage(null);
      setFormData({});
      setAgentError('');
      loadStages();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || t('common.operationFailed');
      toast.error(errorMessage);
      console.error('Failed to save stage:', error);
      
      // 如果是 Agent 相關錯誤，顯示在 agentError 中
      if (errorMessage.includes('Agent') && errorMessage.includes(t('workflowStage.doesNotExist'))) {
        setAgentError(errorMessage);
      }
    }
  };

  const handleDelete = async (stageId: string) => {
    if (!confirm(t('workflowStage.confirmDelete'))) {
      return;
    }
    try {
      await workflowStageService.deleteStage(stageId);
      toast.success(t('workflowStage.deleted'));
      loadStages();
    } catch (error) {
      toast.error(t('common.deleteFailed'));
      console.error('Failed to delete workflow stage:', error);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingStage(null);
    setFormData({});
  };

  const handleTaskChange = (index: number, value: string) => {
    const tasks = [...(formData.suggested_tasks || [])];
    tasks[index] = value;
    setFormData({ ...formData, suggested_tasks: tasks });
  };

  const addTask = () => {
    const tasks = [...(formData.suggested_tasks || []), ''];
    setFormData({ ...formData, suggested_tasks: tasks });
  };

  const removeTask = (index: number) => {
    const tasks = (formData.suggested_tasks || []).filter((_, i) => i !== index);
    setFormData({ ...formData, suggested_tasks: tasks });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 頁面標題 */}
        <div className="glass-card rounded-xl p-4 flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-blue">
              <Workflow className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                {t('workflowStage.title')}
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">{t('workflowStage.subtitle')}</p>
            </div>
            {stages.length > 0 && (
              <span className="px-3 py-1 bg-primary-50 text-primary-700 border border-primary-200 rounded-full text-sm font-medium">
                {t('workflowStage.stageCount', { count: stages.length })}
              </span>
            )}
          </div>

          <button
            onClick={handleCreate}
            className="flex items-center gap-2 btn-primary"
          >
            <Plus className="w-4 h-4" />
            {t('workflowStage.addStage')}
          </button>
        </div>

        {/* 新增表單 - 玻璃卡片 */}
        {isCreating && (
          <div className="glass-card rounded-xl p-5 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('workflowStage.addTitle')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('workflowStage.nameField')}
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder={t('workflowStage.namePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('common.description')}
                </label>
                <input
                  type="text"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  placeholder={t('workflowStage.descPlaceholder')}
                />
              </div>
              {/* 提示詞來源選擇 */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('workflowStage.promptSource')}
                </label>
                <div className="flex gap-4 mb-3">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="custom"
                      checked={promptSource === 'custom'}
                      onChange={() => handlePromptSourceChange('custom')}
                      className="mr-2"
                    />
                    <span className="text-sm">{t('workflowStage.customPrompt')}</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="agent"
                      checked={promptSource === 'agent'}
                      onChange={() => handlePromptSourceChange('agent')}
                      disabled={!isAgentConfigured}
                      className="mr-2"
                    />
                    <span className={`text-sm ${!isAgentConfigured ? 'text-gray-400' : ''}`}>
                      {t('workflowStage.useAgent')}
                    </span>
                    {!isAgentConfigured && (
                      <span className="ml-2 text-xs text-gray-500">
                        {t('workflowStage.setAgentPathFirst')}
                      </span>
                    )}
                  </label>
                </div>

                {/* 根據選擇顯示不同的輸入界面 */}
                {promptSource === 'custom' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('workflowStage.systemPrompt')}
                    </label>
                    <textarea
                      value={formData.system_prompt || ''}
                      onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                      rows={4}
                      className="input"
                      placeholder={t('workflowStage.systemPromptPlaceholder')}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('workflowStage.selectAgentField')}
                    </label>
                    <select
                      value={formData.agent_ref || ''}
                      onChange={(e) => handleAgentChange(e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        agentError ? 'border-red-500' : 'border-gray-300'
                      }`}
                    >
                      <option value="">{t('workflowStage.selectAgentPlaceholder')}</option>
                      {agents.map(agent => (
                        <option key={agent.name} value={agent.name}>
                          {agent.name} ({agent.fileName})
                        </option>
                      ))}
                    </select>
                    
                    {/* Agent 錯誤提示 */}
                    {agentError && (
                      <div className="mt-2 p-3 bg-red-50 border-l-4 border-red-400 rounded">
                        <div className="flex">
                          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                          <div className="ml-2">
                            <p className="text-sm text-red-700">{agentError}</p>
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                onClick={() => window.location.href = '/agent-prompts'}
                                className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200"
                              >
                                {t('workflowStage.checkAgentConfig')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePromptSourceChange('custom')}
                                className="text-sm bg-gray-100 text-gray-800 px-3 py-1 rounded hover:bg-gray-200"
                              >
                                {t('workflowStage.switchToCustom')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 顯示當前 Agent */}
                    {formData.agent_ref && !agentError && (
                      <p className="mt-2 text-sm text-gray-600">
                        <FileText className="inline w-4 h-4 mr-1" />
                        <Trans
                          i18nKey="workflowStage.willUseAgentPrompt"
                          values={{ file: `${formData.agent_ref}.md` }}
                          components={{
                            agentLink: (
                              <a
                                href={`/agent-prompts/${formData.agent_ref}`}
                                className="bg-gray-100 px-1 py-0.5 rounded hover:bg-gray-200 text-blue-600 hover:underline"
                                onClick={(e) => {
                                  e.preventDefault();
                                  window.location.href = `/agent-prompts/${formData.agent_ref}`;
                                }}
                              />
                            ),
                          }}
                        />
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Palette className="inline w-4 h-4 mr-1" />
                  {t('workflowStage.color')}
                </label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <ListTodo className="inline w-4 h-4 mr-1" />
                  {t('workflowStage.suggestedTasks')}
                </label>
                <div className="space-y-2">
                  {(formData.suggested_tasks || []).map((task, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={task}
                        onChange={(e) => handleTaskChange(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder={t('workflowStage.suggestedTaskPlaceholder')}
                      />
                      <button
                        onClick={() => removeTask(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addTask}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {t('workflowStage.addSuggestedTask')}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={handleCancel}
                className="btn-secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 btn-primary"
              >
                <Save className="w-4 h-4" />
                {t('common.save')}
              </button>
            </div>
          </div>
        )}
        

        {/* 階段列表 - 列表模式 */}
        <div className="space-y-3">
          {stages.map((stage) => (
            <div
              key={stage.stage_id}
              className="glass-card rounded-lg overflow-hidden hover:shadow-soft-md transition-all duration-200"
            >
              {editingStage === stage.stage_id ? (
                // 編輯模式 - 列表適配表單
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-800 mb-4">{t('workflowStage.editTitle')}</h4>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 左側基本信息 */}
                    <div className="space-y-3">
                      {/* 名稱和描述 */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">{t('workflowStage.nameField')}</label>
                          <input
                            type="text"
                            value={formData.name || ''}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={t('workflowStage.stageName')}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">{t('workflowStage.color')}</label>
                          <input
                            type="color"
                            value={formData.color || '#8B5CF6'}
                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                            className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('common.description')}</label>
                        <input
                          type="text"
                          value={formData.description || ''}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={t('workflowStage.descPlaceholder')}
                        />
                      </div>

                      {/* 提示詞來源切換 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">{t('workflowStage.promptSource')}</label>
                        <div className="flex gap-4 mb-3">
                          <label className="flex items-center text-sm">
                            <input
                              type="radio"
                              value="custom"
                              checked={promptSource === 'custom'}
                              onChange={() => handlePromptSourceChange('custom')}
                              className="mr-2"
                            />
                            {t('workflowStage.customPrompt')}
                          </label>
                          <label className="flex items-center text-sm">
                            <input
                              type="radio"
                              value="agent"
                              checked={promptSource === 'agent'}
                              onChange={() => handlePromptSourceChange('agent')}
                              disabled={!isAgentConfigured}
                              className="mr-2"
                            />
                            {t('workflowStage.useAgent')}
                          </label>
                        </div>

                        {/* 根據選擇顯示不同輸入 */}
                        {promptSource === 'agent' ? (
                          <div>
                            <select
                              value={formData.agent_ref || ''}
                              onChange={(e) => handleAgentChange(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">{t('workflowStage.selectAgent')}</option>
                              {agents.map(agent => (
                                <option key={agent.name} value={agent.name}>
                                  {agent.name}
                                </option>
                              ))}
                            </select>
                            {agentError && (
                              <p className="mt-1 text-xs text-red-600">{agentError}</p>
                            )}
                          </div>
                        ) : (
                          <textarea
                            value={formData.system_prompt || ''}
                            onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                            rows={4}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={t('workflowStage.systemPromptPlaceholder')}
                          />
                        )}
                      </div>
                    </div>

                    {/* 右側建議任務 */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-2">{t('workflowStage.suggestedTasks')}</label>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(formData.suggested_tasks || []).map((task, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={task}
                              onChange={(e) => {
                                const tasks = [...(formData.suggested_tasks || [])];
                                tasks[index] = e.target.value;
                                setFormData({ ...formData, suggested_tasks: tasks });
                              }}
                              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              placeholder={t('workflowStage.suggestedTaskDesc')}
                            />
                            <button
                              onClick={() => {
                                const tasks = (formData.suggested_tasks || []).filter((_, i) => i !== index);
                                setFormData({ ...formData, suggested_tasks: tasks });
                              }}
                              className="px-2 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const tasks = [...(formData.suggested_tasks || []), ''];
                            setFormData({ ...formData, suggested_tasks: tasks });
                          }}
                          className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all border border-dashed border-blue-300 hover:border-blue-400"
                        >
                          {t('workflowStage.addSuggestedTask')}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 按鈕組 */}
                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 text-sm bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:shadow-blue transition-all"
                    >
                      {t('common.saveChanges')}
                    </button>
                  </div>
                </div>
              ) : (
                // 緊湊列表顯示模式
                <div className="px-4 py-3">
                  <div className="flex items-center gap-4">
                    {/* 階段基本信息 */}
                    <div className="flex items-center gap-3 min-w-0 flex-shrink-0" style={{ width: '200px' }}>
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stage.color }}
                      />
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {stage.name}
                        </h3>
                        {stage.description && (
                          <p className="text-xs text-gray-500 truncate">{stage.description}</p>
                        )}
                      </div>
                    </div>

                    {/* 提示詞來源 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {stage.agent_ref ? '🤖' : '📝'}
                        </span>
                        {stage.agent_ref ? (
                          <a
                            href={`/agent-prompts/${stage.agent_ref}`}
                            className="text-sm bg-primary-50 text-primary-700 px-2 py-0.5 rounded hover:bg-primary-100 transition-all cursor-pointer flex-shrink-0"
                            onClick={(e) => {
                              e.preventDefault();
                              window.location.href = `/agent-prompts/${stage.agent_ref}`;
                            }}
                          >
                            {stage.agent_ref}.md
                          </a>
                        ) : (
                          <p className="text-sm text-gray-700 truncate">
                            {stage.system_prompt}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 建議任務 */}
                    <div className="flex items-center gap-2 min-w-0" style={{ width: '250px' }}>
                      {stage.suggested_tasks && stage.suggested_tasks.length > 0 ? (
                        <>
                          <span className="text-xs text-gray-500 flex-shrink-0">💡</span>
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            <span className="text-sm text-gray-700 truncate">
                              {stage.suggested_tasks[0]}
                            </span>
                            {stage.suggested_tasks.length > 1 && (
                              <button
                                onClick={() => {
                                  const newExpanded = new Set(expandedTasks);
                                  if (expandedTasks.has(stage.stage_id)) {
                                    newExpanded.delete(stage.stage_id);
                                  } else {
                                    newExpanded.add(stage.stage_id);
                                  }
                                  setExpandedTasks(newExpanded);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700 flex-shrink-0"
                              >
                                +{stage.suggested_tasks.length - 1}
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">{t('workflowStage.noSuggestedTasks')}</span>
                      )}
                    </div>

                    {/* 操作按鈕 */}
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(stage)}
                        className="p-1.5 text-gray-600 hover:bg-white/60 rounded transition-all hover:shadow-soft-sm"
                        title={t('common.edit')}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(stage.stage_id)}
                        className="p-1.5 text-danger-600 hover:bg-danger-50 rounded transition-all hover:shadow-soft-sm"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* 展開的建議任務 */}
                  {expandedTasks.has(stage.stage_id) && stage.suggested_tasks && stage.suggested_tasks.length > 1 && (
                    <div className="mt-2 ml-6 pt-2 border-t border-gray-100">
                      <div className="text-xs text-gray-500 mb-1">{t('workflowStage.allSuggestedTasks')}</div>
                      <ul className="text-sm text-gray-700 space-y-0.5">
                        {stage.suggested_tasks.map((task, index) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-1.5 text-gray-400">•</span>
                            <span>{task}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};