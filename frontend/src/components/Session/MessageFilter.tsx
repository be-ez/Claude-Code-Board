import React from 'react';
import { createPortal } from 'react-dom';
import { Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { Message } from '../../types/session.types';
import { useTranslation } from 'react-i18next';

// 訊息類型配置
const MESSAGE_TYPE_CONFIG: Record<Message['type'], { labelKey: string; color: string; defaultVisible: boolean }> = {
  user: { labelKey: 'messageType.user', color: 'text-blue-600', defaultVisible: true },
  claude: { labelKey: 'messageType.claude', color: 'text-green-600', defaultVisible: true },
  assistant: { labelKey: 'messageType.assistant', color: 'text-purple-600', defaultVisible: true },
  system: { labelKey: 'messageType.system', color: 'text-gray-600', defaultVisible: true },
  tool_use: { labelKey: 'messageType.tool', color: 'text-orange-600', defaultVisible: false },
  thinking: { labelKey: 'messageType.thinking', color: 'text-indigo-600', defaultVisible: false },
  output: { labelKey: 'messageType.output', color: 'text-cyan-600', defaultVisible: true },
  error: { labelKey: 'messageType.error', color: 'text-red-600', defaultVisible: true },
};

interface MessageFilterProps {
  hiddenTypes: Set<Message['type']>;
  onFilterChange: (types: Set<Message['type']>) => void;
}

export const MessageFilter: React.FC<MessageFilterProps> = ({ hiddenTypes, onFilterChange }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [buttonRect, setButtonRect] = React.useState<DOMRect | null>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const toggleType = (type: Message['type']) => {
    const newHiddenTypes = new Set(hiddenTypes);
    if (newHiddenTypes.has(type)) {
      newHiddenTypes.delete(type);
    } else {
      newHiddenTypes.add(type);
    }
    onFilterChange(newHiddenTypes);
  };

  const showAll = () => {
    onFilterChange(new Set());
  };

  const hideAll = () => {
    onFilterChange(new Set(Object.keys(MESSAGE_TYPE_CONFIG) as Message['type'][]));
  };

  const resetToDefault = () => {
    const defaultHidden = new Set<Message['type']>();
    Object.entries(MESSAGE_TYPE_CONFIG).forEach(([type, config]) => {
      if (!config.defaultVisible) {
        defaultHidden.add(type as Message['type']);
      }
    });
    onFilterChange(defaultHidden);
  };

  const visibleCount = Object.keys(MESSAGE_TYPE_CONFIG).length - hiddenTypes.size;

  const handleToggle = () => {
    if (!isExpanded && buttonRef.current) {
      setButtonRect(buttonRef.current.getBoundingClientRect());
    }
    setIsExpanded(!isExpanded);
  };

  // 點擊外部關閉
  React.useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // 檢查點擊是否在按鈕或下拉選單內
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  return (
    <div className="relative">
      {/* 過濾器按鈕 */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Filter className="w-4 h-4" />
        <span>{t('messageFilter.title', { visible: visibleCount, total: Object.keys(MESSAGE_TYPE_CONFIG).length })}</span>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* 過濾器面板 - 使用 Portal 渲染到 body */}
      {isExpanded && buttonRect && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-white rounded-lg shadow-2xl border border-gray-200 p-4 z-[99999] min-w-[280px]"
          style={{
            top: buttonRect.bottom + 8,
            right: window.innerWidth - buttonRect.right,
          }}
        >
          <div className="space-y-3">
            {/* 快速操作按鈕 */}
            <div className="flex gap-2 pb-3 border-b border-gray-200">
              <button
                onClick={showAll}
                className="flex-1 px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                {t('messageFilter.showAll')}
              </button>
              <button
                onClick={hideAll}
                className="flex-1 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 rounded transition-colors"
              >
                {t('messageFilter.hideAll')}
              </button>
              <button
                onClick={resetToDefault}
                className="flex-1 px-3 py-1 text-xs text-green-600 hover:bg-green-50 rounded transition-colors"
              >
                {t('messageFilter.defaults')}
              </button>
            </div>

            {/* 訊息類型選項 */}
            <div className="space-y-2">
              {Object.entries(MESSAGE_TYPE_CONFIG).map(([type, config]) => {
                const isVisible = !hiddenTypes.has(type as Message['type']);
                return (
                  <label
                    key={type}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => toggleType(type as Message['type'])}
                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className={`text-sm ${config.color}`}>{t(config.labelKey)}</span>
                    {!config.defaultVisible && (
                      <span className="text-xs text-gray-400 ml-auto">{t('messageFilter.hiddenByDefault')}</span>
                    )}
                  </label>
                );
              })}
            </div>

            {/* 統計資訊 */}
            <div className="pt-3 border-t border-gray-200 text-xs text-gray-500">
              {hiddenTypes.size > 0 ? (
                <span>{t('messageFilter.hiddenTypes', { count: hiddenTypes.size })}</span>
              ) : (
                <span>{t('messageFilter.allTypesShown')}</span>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};