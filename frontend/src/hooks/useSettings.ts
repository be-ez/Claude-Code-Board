import { useState, useEffect } from 'react';
import { commonPathApi, CommonPath } from '../services/api';
import toast from 'react-hot-toast';
import i18n from '../i18n';

export type { CommonPath };

export const useSettings = () => {
  const [commonPaths, setCommonPaths] = useState<CommonPath[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 載入設定
  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const paths = await commonPathApi.getAllPaths();
      setCommonPaths(paths);
    } catch (error) {
      console.error('Failed to load common paths:', error);
      toast.error(i18n.t('settings.loadPathsFailed'));
      // 使用空陣列作為後備
      setCommonPaths([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 儲存設定（批量更新）
  const saveSettings = async (newPaths: CommonPath[]): Promise<boolean> => {
    try {
      // 如果是重新排序，使用 reorder API
      const reorderData = newPaths.map((path, index) => ({
        id: path.id,
        sort_order: index + 1
      }));
      
      await commonPathApi.reorderPaths(reorderData);
      setCommonPaths(newPaths);
      
      // 觸發自定義事件以通知其他元件
      window.dispatchEvent(new Event('settings-updated'));
      
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error(i18n.t('settings.saveFailed'));
      return false;
    }
  };

  // 重置為預設設定
  const resetToDefault = async (): Promise<boolean> => {
    try {
      const paths = await commonPathApi.resetToDefault();
      setCommonPaths(paths);
      
      // 觸發自定義事件以通知其他元件
      window.dispatchEvent(new Event('settings-updated'));
      
      toast.success(i18n.t('settings.resetDone'));
      return true;
    } catch (error) {
      console.error('Failed to reset settings:', error);
      toast.error(i18n.t('settings.resetFailed'));
      return false;
    }
  };

  // 新增常用路徑
  const addCommonPath = async (path: Omit<CommonPath, 'id'>): Promise<boolean> => {
    try {
      const created = await commonPathApi.createPath({
        label: path.label,
        path: path.path,
        icon: path.icon,
        sort_order: commonPaths.length + 1
      });
      
      setCommonPaths([...commonPaths, created]);
      
      // 觸發自定義事件
      window.dispatchEvent(new Event('settings-updated'));
      
      toast.success(i18n.t('settings.pathAdded'));
      return true;
    } catch (error) {
      console.error('Failed to add common path:', error);
      toast.error(i18n.t('settings.pathAddFailed'));
      return false;
    }
  };

  // 更新常用路徑
  const updateCommonPath = async (id: string, updates: Partial<CommonPath>): Promise<boolean> => {
    try {
      const updated = await commonPathApi.updatePath(id, updates);
      
      setCommonPaths(commonPaths.map(path => 
        path.id === id ? updated : path
      ));
      
      // 觸發自定義事件
      window.dispatchEvent(new Event('settings-updated'));
      
      toast.success(i18n.t('settings.pathUpdated'));
      return true;
    } catch (error) {
      console.error('Failed to update common path:', error);
      toast.error(i18n.t('settings.pathUpdateFailed'));
      return false;
    }
  };

  // 刪除常用路徑
  const deleteCommonPath = async (id: string): Promise<boolean> => {
    try {
      await commonPathApi.deletePath(id);
      
      setCommonPaths(commonPaths.filter(path => path.id !== id));
      
      // 觸發自定義事件
      window.dispatchEvent(new Event('settings-updated'));
      
      toast.success(i18n.t('settings.pathDeleted'));
      return true;
    } catch (error) {
      console.error('Failed to delete common path:', error);
      toast.error(i18n.t('settings.pathDeleteFailed'));
      return false;
    }
  };

  // 取得設定資訊
  const getSettingsInfo = () => {
    return {
      hasCustomSettings: commonPaths.length > 0,
      lastUpdated: null, // 可以從 commonPaths 中取得最新的 updated_at
      pathCount: commonPaths.length,
    };
  };

  // 初始化載入
  useEffect(() => {
    loadSettings();
  }, []);

  // 監聽自定義事件，用於同一標籤頁內的同步
  useEffect(() => {
    const handleCustomStorageChange = () => {
      loadSettings();
    };
    
    window.addEventListener('settings-updated', handleCustomStorageChange);

    return () => {
      window.removeEventListener('settings-updated', handleCustomStorageChange);
    };
  }, []);

  return {
    commonPaths,
    isLoading,
    saveSettings,
    resetToDefault,
    addCommonPath,
    updateCommonPath,
    deleteCommonPath,
    getSettingsInfo,
    reloadSettings: loadSettings,
  };
};