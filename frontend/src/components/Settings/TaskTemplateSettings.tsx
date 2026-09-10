import React, { useState } from 'react';
import { Plus, Trash2, Edit2, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTaskTemplates } from '../../hooks/useTaskTemplates';
import { TaskTemplate } from '../../types/taskTemplate.types';
import { useTranslation } from 'react-i18next';

export const TaskTemplateSettings: React.FC = () => {
  const { t } = useTranslation();
  const {
    templates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    resetToDefault,
  } = useTaskTemplates();

  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTemplateData, setNewTemplateData] = useState({
    label: '',
    template: '',
  });

  const addNewTemplate = () => {
    setIsAddingNew(true);
    setEditingTemplate(null);
    setNewTemplateData({
      label: '',
      template: '',
    });
  };

  const handleSaveNewTemplate = async () => {
    if (!newTemplateData.label.trim() || !newTemplateData.template.trim()) {
      toast.error(t('taskTemplate.labelContentRequired'));
      return;
    }

    const success = await createTemplate({
      label: newTemplateData.label,
      template: newTemplateData.template,
    });

    if (success) {
      setIsAddingNew(false);
      setNewTemplateData({ label: '', template: '' });
    }
  };

  const handleCancelNewTemplate = () => {
    setIsAddingNew(false);
    setNewTemplateData({ label: '', template: '' });
  };

  const deleteTemplateHandler = async (id: string) => {
    const template = templates.find(t => t.id === id);
    if (template?.is_default) {
      toast.error(t('taskTemplate.cannotDeleteDefault'));
      return;
    }

    await deleteTemplate(id);
    if (editingTemplate?.id === id) {
      setEditingTemplate(null);
    }
  };

  const updateTemplateHandler = async (updatedTemplate: TaskTemplate) => {
    const success = await updateTemplate(updatedTemplate.id, {
      label: updatedTemplate.label,
      template: updatedTemplate.template,
    });

    if (success) {
      setEditingTemplate(null);
    }
  };

  const handleResetToDefault = async () => {
    if (window.confirm(t('taskTemplate.confirmReset'))) {
      const success = await resetToDefault();
      if (success) {
        setEditingTemplate(null);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">{t('settings.taskTemplates')}</h3>
        <div className="flex space-x-2">
          <button
            onClick={handleResetToDefault}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {t('settings.resetDefaults')}
          </button>
          <button
            onClick={addNewTemplate}
            disabled={isAddingNew}
            className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('common.add')}</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* 新增模板的編輯表單 */}
        {isAddingNew && (
          <div className="border border-green-300 rounded-lg p-3 sm:p-4 bg-green-50">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('taskTemplate.labelField')}
                </label>
                <input
                  type="text"
                  value={newTemplateData.label}
                  onChange={(e) => setNewTemplateData(prev => ({ ...prev, label: e.target.value }))}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder={t('taskTemplate.labelPlaceholder')}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('taskTemplate.contentField')}
                </label>
                <textarea
                  value={newTemplateData.template}
                  onChange={(e) => setNewTemplateData(prev => ({ ...prev, template: e.target.value }))}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                  placeholder={t('taskTemplate.contentPlaceholder')}
                  rows={4}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {t('common.charCount', { count: newTemplateData.template.length })}
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={handleCancelNewTemplate}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSaveNewTemplate}
                  className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  {t('common.add')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 現有模板列表 */}
        {templates.map((template) => (
          <TemplateEditor
            key={template.id}
            template={template}
            isEditing={editingTemplate?.id === template.id}
            onEdit={(t) => {
              setEditingTemplate(t);
              setIsAddingNew(false);
            }}
            onUpdate={updateTemplateHandler}
            onDelete={deleteTemplateHandler}
          />
        ))}
      </div>

      {templates.length === 0 && !isAddingNew && (
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{t('taskTemplate.empty')}</p>
          <button
            onClick={addNewTemplate}
            className="mt-2 text-blue-600 hover:text-blue-700"
          >
            {t('taskTemplate.addFirst')}
          </button>
        </div>
      )}
    </div>
  );
};

// 模板編輯器組件
interface TemplateEditorProps {
  template: TaskTemplate;
  isEditing: boolean;
  onEdit: (template: TaskTemplate | null) => void;
  onUpdate: (template: TaskTemplate) => void;
  onDelete: (id: string) => void;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  isEditing,
  onEdit,
  onUpdate,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [editData, setEditData] = useState<TaskTemplate>(template);

  React.useEffect(() => {
    setEditData(template);
  }, [template, isEditing]);

  const handleSave = () => {
    if (!editData.label.trim() || !editData.template.trim()) {
      toast.error(t('taskTemplate.labelContentRequired'));
      return;
    }
    onUpdate(editData);
  };

  const handleCancel = () => {
    setEditData(template);
    onEdit(null);
  };

  if (isEditing) {
    return (
      <div className="border border-blue-300 rounded-lg p-3 sm:p-4 bg-blue-50">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('taskTemplate.labelField')}
            </label>
            <input
              type="text"
              value={editData.label}
              onChange={(e) => setEditData(prev => ({ ...prev, label: e.target.value }))}
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={t('tag.label')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('taskTemplate.contentField')}
            </label>
            <textarea
              value={editData.template}
              onChange={(e) => setEditData(prev => ({ ...prev, template: e.target.value }))}
              className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder={t('taskTemplate.content')}
              rows={4}
            />
            <div className="text-xs text-gray-500 mt-1">
              {t('common.charCount', { count: editData.template.length })}
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors gap-3">
      <div className="flex items-start space-x-3 min-w-0 flex-1">
        <MessageSquare className="w-4 h-4 text-gray-600 flex-shrink-0 mt-1" />
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-900 flex items-center gap-2">
            {template.label}
            {template.is_default && (
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                {t('common.default')}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600 mt-1 line-clamp-2">
            {template.template}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-1 flex-shrink-0">
        <button
          onClick={() => onEdit(template)}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title={t('common.edit')}
        >
          <Edit2 className="w-4 h-4" />
        </button>
        {!template.is_default && (
          <button
            onClick={() => onDelete(template.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title={t('common.delete')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};