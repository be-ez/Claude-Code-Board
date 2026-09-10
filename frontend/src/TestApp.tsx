import { useTranslation } from 'react-i18next';
function TestApp() {
  const { t } = useTranslation();
  return (
    <div style={{ padding: '20px', fontSize: '18px' }}>
      <h1>{t('testApp.title')}</h1>
      <p>{t('testApp.description')}</p>
      <div style={{ marginTop: '20px' }}>
        <button style={{ padding: '10px 20px', backgroundColor: '#blue', color: 'white' }}>
          {t('testApp.button')}
        </button>
      </div>
    </div>
  );
}

export default TestApp;