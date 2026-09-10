import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Download, FolderGit2, MessageSquare, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';
import { claudeImportApi, DiscoveredClaudeSession } from '../../services/claudeImportService';
import { getDateLocale } from '../../i18n';

interface ImportSessionsSettingsProps {
  /** Called after a successful import so the session list can refresh. */
  onImported?: () => void;
}

export const ImportSessionsSettings: React.FC<ImportSessionsSettingsProps> = ({ onImported }) => {
  const { t } = useTranslation();
  const dateLocale = getDateLocale();

  const [sessions, setSessions] = useState<DiscoveredClaudeSession[]>([]);
  const [projectsPath, setProjectsPath] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await claudeImportApi.discover();
      setSessions(data.sessions);
      setProjectsPath(data.projectsPath);
      setSelected(new Set());
    } catch (error) {
      console.error('Failed to discover Claude sessions:', error);
      toast.error(t('importSessions.discoverFailed'));
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const importable = useMemo(() => sessions.filter((s) => !s.alreadyImported), [sessions]);
  const allSelected = importable.length > 0 && selected.size === importable.length;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(importable.map((s) => s.claudeSessionId)));
  };

  const runImport = async () => {
    if (selected.size === 0) return;
    try {
      setIsImporting(true);
      const result = await claudeImportApi.importSessions([...selected]);
      if (result.imported.length > 0) {
        toast.success(t('importSessions.imported', { count: result.imported.length }));
        onImported?.();
      }
      if (result.skipped.length > 0) {
        toast(t('importSessions.skipped', { count: result.skipped.length }));
      }
      await load();
    } catch (error) {
      console.error('Failed to import Claude sessions:', error);
      toast.error(t('importSessions.importFailed'));
    } finally {
      setIsImporting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const relative = (iso: string | null) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return formatDistanceToNow(date, { locale: dateLocale, addSuffix: true });
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-gray-700">{t('importSessions.title')}</h3>
          <p className="text-xs text-gray-500 mt-1 break-all">
            {projectsPath
              ? t('importSessions.scanningPath', { path: projectsPath })
              : t('importSessions.description')}
          </p>
        </div>
        <button
          onClick={load}
          disabled={isLoading || isImporting}
          className="flex items-center space-x-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{t('common.reload')}</span>
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500 py-6 text-center">{t('common.loading')}</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-8">
          <FolderGit2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600">{t('importSessions.empty')}</p>
          <p className="text-xs text-gray-500 mt-1">{t('importSessions.emptyHint')}</p>
        </div>
      ) : (
        <>
          {importable.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-sm text-blue-600 hover:text-blue-700 mb-2"
            >
              {allSelected ? t('messageFilter.hideAll') : t('importSessions.selectAll')}
            </button>
          )}

          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {sessions.map((session) => {
              const isSelected = selected.has(session.claudeSessionId);
              const disabled = session.alreadyImported;
              return (
                <label
                  key={session.claudeSessionId}
                  className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${
                    disabled
                      ? 'border-gray-100 bg-gray-50 cursor-not-allowed'
                      : isSelected
                        ? 'border-blue-600 bg-blue-50 cursor-pointer'
                        : 'border-gray-200 hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={isSelected}
                    disabled={disabled || isImporting}
                    onChange={() => toggle(session.claudeSessionId)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {session.title}
                      </span>
                      {disabled && (
                        <span className="flex items-center gap-1 text-xs text-green-600 flex-shrink-0">
                          <Check className="w-3 h-3" />
                          {t('importSessions.alreadyImported')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{session.workingDir}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 mt-1">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {t('session.messageCount', { count: session.messageCount })}
                      </span>
                      {session.lastActivityAt && <span>{relative(session.lastActivityAt)}</span>}
                      <span>{formatSize(session.sizeBytes)}</span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">
              {t('importSessions.selectedCount', { count: selected.size })}
            </span>
            <button
              onClick={runImport}
              disabled={selected.size === 0 || isImporting}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{isImporting ? t('importSessions.importing') : t('importSessions.import')}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
