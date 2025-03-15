import { defaultKAGConfig, KAGConfig } from '../api';

/**
 * Save KAG configuration to localStorage for persistence
 * @param config - The KAG configuration to save
 */
export const saveKAGConfig = (config: KAGConfig): void => {
  localStorage.setItem('kag_config', JSON.stringify(config));
};

/**
 * Load KAG configuration from localStorage
 * @returns The saved KAG configuration or the default if none exists
 */
export const loadKAGConfig = (): KAGConfig => {
  const savedConfig = localStorage.getItem('kag_config');
  if (!savedConfig) return defaultKAGConfig;
  
  try {
    return { ...defaultKAGConfig, ...JSON.parse(savedConfig) };
  } catch (error) {
    console.error('Error parsing saved KAG config:', error);
    return defaultKAGConfig;
  }
};

/**
 * Import a Postman environment file
 * @param file - The file object containing the Postman environment JSON
 * @returns Promise resolving to the loaded KAG configuration
 */
export const importPostmanEnvironment = async (file: File): Promise<KAGConfig> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const config = loadKAGConfigFromPostman(json);
        saveKAGConfig(config);
        resolve(config);
      } catch (error) {
        reject(new Error('Failed to parse Postman environment file'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read Postman environment file'));
    };
    
    reader.readAsText(file);
  });
};

/**
 * Load KAG configuration from a Postman environment file
 * @param environmentJson - The Postman environment JSON
 * @returns KAGConfig object with values from the environment file
 */
export const loadKAGConfigFromPostman = (environmentJson: any): KAGConfig => {
  if (!environmentJson || !environmentJson.values) {
    console.error('Invalid Postman environment format');
    return defaultKAGConfig;
  }

  const config: KAGConfig = { ...defaultKAGConfig };
  
  // Map Postman environment variables to our config
  environmentJson.values.forEach((item: any) => {
    if (!item.enabled) return;
    
    switch (item.key) {
      case 'base_url':
        config.base_url = item.value;
        break;
      case 'neo4j_uri':
        config.neo4j_uri = item.value;
        break;
      case 'neo4j_user':
        config.neo4j_user = item.value;
        break;
      case 'neo4j_password':
        config.neo4j_password = item.value;
        break;
      case 'openai_api_key':
        config.openai_api_key = item.value;
        break;
      case 'document_id':
        config.document_id = item.value;
        break;
    }
  });

  return config;
}; 