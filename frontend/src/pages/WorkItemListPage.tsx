import React, { useEffect, useState } from 'react';
import { Plus, Briefcase, RefreshCw } from 'lucide-react';
import { useWorkItemStore } from '../stores/workItemStore';
import { useWorkflowStageStore } from '../stores/workflowStageStore';
import toast from 'react-hot-toast';
import { WorkItemRow } from '../components/WorkItem/WorkItemRow';
import { CreateWorkItemDialog } from '../components/WorkItem/CreateWorkItemDialog';
import { EditWorkItemDialog } from '../components/WorkItem/EditWorkItemDialog';
import { WorkItemStatus, WorkItem } from '../types/workitem';
import { SearchBar } from '../components/Common/SearchBar';
import { useTranslation } from 'react-i18next';

export const WorkItemListPage: React.FC = () => {
  const { t } = useTranslation();
  const {
    workItems,
    stats,
    loading,
    error,
    fetchWorkItems,
    fetchStats,
    updateWorkItem,
    deleteWorkItem,
    clearError
  } = useWorkItemStore();
  
  const { fetchStages } = useWorkflowStageStore();
  
  const [statusFilter, setStatusFilter] = useState<WorkItemStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingWorkItem, setEditingWorkItem] = useState<WorkItem | null>(null);

  useEffect(() => {
    // 初始載入
    loadData();
    fetchStages();
  }, []);

  useEffect(() => {
    // 當篩選條件改變時重新載入
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    const status = statusFilter === 'all' ? undefined : statusFilter;
    await Promise.all([
      fetchWorkItems(status),
      fetchStats()
    ]);
  };

  const handleStatusChange = async (workItemId: string, status: WorkItemStatus) => {
    try {
      await updateWorkItem(workItemId, { 
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : undefined
      });
      await fetchStats();
      
      // 顯示成功提示
      const statusText: Record<string, string> = {
        'planning': t('workItemDetail.setPlanning'),
        'in_progress': t('workItemDetail.setInProgress'),
        'completed': t('workItemDetail.setCompleted'),
        'cancelled': t('workItemStatus.cancelled')
      };
      toast.success(t('workItemDetail.workItemStatus', { status: statusText[status] || t('workItemDetail.statusUpdated') }));
    } catch (err) {
      console.error('Failed to update work item status:', err);
      toast.error(t('workItemDetail.statusUpdateFailed'));
    }
  };

  const handleDelete = async (workItemId: string) => {
    if (window.confirm(t('workItemList.confirmDelete'))) {
      try {
        await deleteWorkItem(workItemId);
        await fetchStats();
        toast.success(t('workItemDetail.deleted'));
      } catch (err) {
        console.error('Failed to delete work item:', err);
        toast.error(t('workItemDetail.deleteFailed'));
      }
    }
  };

  const handleWorkItemCreated = () => {
    loadData();
    toast.success(t('workItemList.created'));
  };

  const handleEdit = (workItem: WorkItem) => {
    setEditingWorkItem(workItem);
    setEditDialogOpen(true);
  };

  const handleWorkItemUpdated = () => {
    loadData();
    setEditDialogOpen(false);
    setEditingWorkItem(null);
    toast.success(t('workItemDetail.updated'));
  };

  // 搜尋過濾和排序
  const filteredWorkItems = workItems
    .filter(item =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      // 當篩選為「全部」時，按狀態排序：規劃中 -> 進行中 -> 已完成 -> 已取消
      if (statusFilter === 'all') {
        const statusOrder = {
          'planning': 1,
          'in_progress': 2,
          'completed': 3,
          'cancelled': 4
        };
        return statusOrder[a.status] - statusOrder[b.status];
      }
      // 其他情況按創建時間排序（最新的在前）
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const statusTabs = [
    { value: 'all', label: t('common.all'), count: stats?.total },
    { value: 'planning', label: t('workItemStatus.planning'), count: stats?.planning },
    { value: 'in_progress', label: t('workItemStatus.inProgress'), count: stats?.in_progress },
    { value: 'completed', label: t('common.completed'), count: stats?.completed },
    { value: 'cancelled', label: t('workItemStatus.cancelled'), count: stats?.cancelled }
  ];

  return (
    <div className="flex-1">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="glass-card rounded-xl p-4 flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-blue">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Work Items</h1>
            {stats && (
              <span className="px-3 py-1 bg-primary-50 text-primary-700 border border-primary-200 rounded-full text-sm font-medium">
                {t('common.totalCount', { count: stats.total })}
              </span>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all hover:shadow-soft-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setCreateDialogOpen(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {t('workItemList.add')}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-danger-50 border border-danger-200 rounded-xl flex justify-between items-center shadow-soft">
            <span className="text-danger-700">{error}</span>
            <button
              onClick={clearError}
              className="text-danger-500 hover:text-danger-700 transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tabs and Search */}
        <div className="glass-card rounded-xl shadow-soft mb-6">
          <div className="border-b border-glass-border">
            <nav className="flex -mb-px">
              {statusTabs.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value as WorkItemStatus | 'all')}
                  className={`
                    px-6 py-3 border-b-2 font-medium text-sm transition-colors
                    ${statusFilter === tab.value
                      ? 'border-primary-500 text-primary-600 bg-primary-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <span className="flex items-center gap-2">
                    {tab.label}
                    {tab.count !== undefined && (
                      <span className="px-2 py-0.5 bg-white/80 text-gray-600 rounded-full text-xs border border-gray-200">
                        {tab.count}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </nav>
          </div>
          
          <div className="p-4">
            <SearchBar
              placeholder={t('workItemList.search')}
              onSearch={setSearchQuery}
              defaultValue={searchQuery}
              className="w-full"
            />
          </div>
        </div>

        {/* Content */}
        {loading && !workItems.length ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredWorkItems.length === 0 ? (
          <div className="glass-extreme rounded-xl p-16 text-center">
            <div className="inline-flex p-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mb-4">
              <Briefcase className="w-16 h-16 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? t('workItemList.noResults') : t('workItemList.empty')}
            </h3>
            <p className="text-gray-500 mb-6">
              {t('workItemList.emptyHint')}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setCreateDialogOpen(true)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                {t('workItemList.createFirst')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWorkItems.map(workItem => (
              <WorkItemRow
                key={workItem.work_item_id}
                workItem={workItem}
                onEdit={handleEdit}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <CreateWorkItemDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onCreated={handleWorkItemCreated}
        />

        {/* Edit Dialog */}
        <EditWorkItemDialog
          open={editDialogOpen}
          workItem={editingWorkItem}
          onClose={() => {
            setEditDialogOpen(false);
            setEditingWorkItem(null);
          }}
          onUpdated={handleWorkItemUpdated}
        />

        {/* Floating Action Button for mobile */}
        <button
          onClick={() => setCreateDialogOpen(true)}
          className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};