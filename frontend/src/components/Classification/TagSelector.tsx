import React, { useState, useEffect } from 'react';
import { tagApi } from '../../services/api';
import { Tag } from '../../types/classification.types';
import { MultiSelect } from '../Common/MultiSelect';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface TagSelectorProps {
  sessionId: string;
  selectedTags: string[];
  onTagsChange: (tagIds: string[]) => void;
  tagType?: 'general' | 'topic' | 'department';
  className?: string;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
  sessionId,
  selectedTags,
  onTagsChange,
  tagType = 'general',
  className,
}) => {
  const { t } = useTranslation();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 載入標籤
  useEffect(() => {
    loadTags();
  }, [tagType]);

  const loadTags = async () => {
    try {
      setLoading(true);
      const allTags = tagType ? await tagApi.getTagsByType(tagType) : await tagApi.getAllTags();
      setTags(allTags);
    } catch (error) {
      console.error('Failed to load tags:', error);
      toast.error(t('tag.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 處理標籤變更
  const handleTagsChange = async (newTagIds: string[]) => {
    try {
      setSaving(true);
      await tagApi.updateSessionTags(sessionId, newTagIds);
      onTagsChange(newTagIds);
      toast.success(t('tag.updated'));
    } catch (error) {
      console.error('Failed to update tags:', error);
      toast.error(t('tag.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  // 建立新標籤
  const handleCreateTag = async (name: string) => {
    try {
      const newTag = await tagApi.createTag({
        name,
        type: tagType,
        color: '#' + Math.floor(Math.random()*16777215).toString(16), // 隨機顏色
      });
      
      // 重新載入標籤列表
      await loadTags();
      
      // 自動選擇新建立的標籤
      const newTagIds = [...selectedTags, newTag.tag_id];
      await handleTagsChange(newTagIds);
      
      toast.success(t('tag.created'));
    } catch (error) {
      console.error('Failed to create tag:', error);
      toast.error(t('tag.createFailed'));
      throw error;
    }
  };

  // 轉換標籤為選項格式
  const options = tags.map(tag => ({
    value: tag.tag_id,
    label: tag.name,
    color: tag.color,
  }));

  // 根據標籤類型顯示不同的標題
  const getLabel = () => {
    switch (tagType) {
      case 'topic':
        return t('tag.topic');
      case 'department':
        return t('tag.department');
      default:
        return t('tag.label');
    }
  };

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {getLabel()}
      </label>
      <MultiSelect
        options={options}
        value={selectedTags}
        onChange={handleTagsChange}
        placeholder={t('tag.selectPlaceholder', { label: getLabel() })}
        disabled={saving}
        loading={loading}
        onCreateNew={handleCreateTag}
        createNewPlaceholder={t('tag.createNewLabel', { label: getLabel() })}
      />
    </div>
  );
};