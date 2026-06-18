// src/pages/NotFound.tsx
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation();

    
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-6xl font-bold text-gray-800 mb-4">{t('notFound.errorCode')}</h1>
      <h2 className="text-2xl font-semibold text-gray-600 mb-6">{t('notFound.pageNotFound')}</h2>
      <p className="text-gray-500 mb-8">
        {t('notFound.errorMessage')}
      </p>
      <Link 
        to="/" 
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        {t('notFound.returnHome')}
      </Link>
    </div>
  );
}
