import React from 'react';
import { useTranslation } from 'react-i18next';

export const GlassDemo: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen p-8 relative overflow-hidden">
      <h1 className="text-3xl font-bold mb-8 text-center">{t('glassDemo.title')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">

        {/* 無效果 - 對照組 */}
        <div className="p-6 bg-white border border-gray-200 rounded-xl">
          <h2 className="text-xl font-semibold mb-2">{t('glassDemo.plainTitle')}</h2>
          <p className="text-gray-600">{t('glassDemo.plainDesc')}</p>
          <div className="mt-4 p-3 bg-gray-100 rounded">
            backdrop-filter: none
          </div>
        </div>

        {/* glass 類別 */}
        <div className="glass p-6 rounded-xl">
          <h2 className="text-xl font-semibold mb-2">{t('glassDemo.standardTitle')}</h2>
          <p className="text-gray-600">{t('glassDemo.standardDesc')}</p>
          <div className="mt-4 p-3 bg-white/50 rounded">
            blur(10px) saturate(180%)
          </div>
        </div>

        {/* glass-card 類別 */}
        <div className="glass-card p-6 rounded-xl">
          <h2 className="text-xl font-semibold mb-2">{t('glassDemo.cardTitle')}</h2>
          <p className="text-gray-600">{t('glassDemo.cardDesc')}</p>
          <div className="mt-4 p-3 bg-white/50 rounded">
            blur(16px) saturate(150%)
          </div>
        </div>

        {/* glass-ultra 類別 */}
        <div className="glass-ultra p-6 rounded-xl">
          <h2 className="text-xl font-semibold mb-2">{t('glassDemo.ultraTitle')}</h2>
          <p className="text-gray-600">{t('glassDemo.ultraDesc')}</p>
          <div className="mt-4 p-3 bg-white/50 rounded">
            blur(24px) saturate(200%)
          </div>
        </div>

        {/* glass-extreme 類別 */}
        <div className="glass-extreme p-6 rounded-xl">
          <h2 className="text-xl font-semibold mb-2">{t('glassDemo.extremeTitle')}</h2>
          <p className="text-gray-600">{t('glassDemo.extremeDesc')}</p>
          <div className="mt-4 p-3 bg-white/50 rounded">
            blur(20px) saturate(200%)
          </div>
        </div>

        {/* glass-fallback 類別 */}
        <div className="glass-fallback p-6 rounded-xl">
          <h2 className="text-xl font-semibold mb-2">{t('glassDemo.fallbackTitle')}</h2>
          <p className="text-gray-600">{t('glassDemo.fallbackDesc')}</p>
          <div className="mt-4 p-3 bg-white/50 rounded">
            {t('glassDemo.fallbackNote')}
          </div>
        </div>

        {/* 測試極低透明度 */}
        <div className="p-6 rounded-xl" style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(40px) saturate(300%)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
        }}>
          <h2 className="text-xl font-semibold mb-2">{t('glassDemo.lowOpacityTitle')}</h2>
          <p className="text-gray-600">{t('glassDemo.lowOpacityDesc')}</p>
          <div className="mt-4 p-3 bg-white/50 rounded">
            {t('glassDemo.lowOpacityNote')}
          </div>
        </div>

        {/* 純模糊測試 */}
        <div className="p-6 rounded-xl" style={{
          background: 'transparent',
          backdropFilter: 'blur(50px)',
          border: '2px solid rgba(255, 255, 255, 0.5)',
          boxShadow: 'inset 0 0 20px rgba(255, 255, 255, 0.5)'
        }}>
          <h2 className="text-xl font-semibold mb-2">{t('glassDemo.blurTitle')}</h2>
          <p className="text-gray-600">transparent + blur(50px)</p>
          <div className="mt-4 p-3 bg-white/50 rounded">
            {t('glassDemo.blurDesc')}
          </div>
        </div>

        {/* 彩色玻璃測試 */}
        <div className="p-6 rounded-xl" style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(147, 51, 234, 0.1))',
          backdropFilter: 'blur(20px) hue-rotate(30deg)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          boxShadow: '0 8px 32px rgba(59, 130, 246, 0.2)'
        }}>
          <h2 className="text-xl font-semibold mb-2">{t('glassDemo.colorTitle')}</h2>
          <p className="text-gray-600">{t('glassDemo.colorDesc')}</p>
          <div className="mt-4 p-3 bg-white/50 rounded">
            {t('glassDemo.colorNote')}
          </div>
        </div>

      </div>

      {/* 強烈的背景元素來測試玻璃效果 */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        {/* 大型漸變圓形 */}
        <div className="absolute top-10 left-10 w-96 h-96 bg-gradient-to-br from-purple-500 via-pink-500 to-red-500 rounded-full animate-float"></div>
        <div className="absolute bottom-10 right-10 w-[500px] h-[500px] bg-gradient-to-tr from-blue-500 via-cyan-500 to-green-500 rounded-full animate-float" style={{animationDelay: '3s'}}></div>
        <div className="absolute top-1/3 left-1/2 w-80 h-80 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 rounded-full animate-float" style={{animationDelay: '5s'}}></div>

        {/* 幾何圖形 */}
        <div className="absolute top-1/2 left-1/4 w-40 h-40 bg-gradient-to-br from-indigo-600 to-purple-600 rotate-45 animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/3 w-60 h-60 bg-gradient-to-tr from-green-500 to-teal-500 rotate-12 animate-pulse" style={{animationDelay: '1s'}}></div>

        {/* 文字背景 */}
        <div className="absolute top-1/4 right-1/4 text-[100px] font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 select-none">
          GLASS
        </div>
        <div className="absolute bottom-1/4 left-1/3 text-[80px] font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600 rotate-[-15deg] select-none">
          EFFECT
        </div>

        {/* 條紋背景 */}
        <div className="absolute inset-0 opacity-20">
          <div className="h-full w-full" style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              #3b82f6,
              #3b82f6 10px,
              #8b5cf6 10px,
              #8b5cf6 20px,
              #ec4899 20px,
              #ec4899 30px
            )`
          }}></div>
        </div>
      </div>
    </div>
  );
};

export default GlassDemo;