import * as React from "react";
import { useState, useEffect, useRef } from "react";

interface WordPressFormProps {
  onSubmit: (
    wpUrl: string, 
    endpoint: string, 
    layerMappings: Record<string, string>,
    duplicationOptions?: {
      duplicateTemplate: boolean;
      templateSpacing: number;
      gridLayout: boolean;
      gridColumns: number;
    }
  ) => void;
  isLoading: boolean;
}

interface PostType {
  slug: string;
  name: string;
  rest_base: string;
}

interface FigmaLayer {
  name: string;
  type: string;
}

// Storage keys
const STORAGE_KEY_PREFIX = 'figpress_';
const STORAGE_KEYS = {
  WP_URL: `${STORAGE_KEY_PREFIX}wp_url`,
  RECENT_URLS: `${STORAGE_KEY_PREFIX}recent_urls`,
  ENDPOINT: `${STORAGE_KEY_PREFIX}endpoint`,
  MAPPINGS: `${STORAGE_KEY_PREFIX}mappings`,
  INCLUDE_EMBEDDED: `${STORAGE_KEY_PREFIX}include_embedded`,
  DUPLICATE_TEMPLATE: `${STORAGE_KEY_PREFIX}duplicate_template`,
  TEMPLATE_SPACING: `${STORAGE_KEY_PREFIX}template_spacing`,
  GRID_LAYOUT: `${STORAGE_KEY_PREFIX}grid_layout`,
  GRID_COLUMNS: `${STORAGE_KEY_PREFIX}grid_columns`,
  LAST_CONNECTION: `${STORAGE_KEY_PREFIX}last_connection`
};

// Fallback in-memory storage when localStorage is not available
const memoryStorage: Record<string, string> = {};

// Check if localStorage is available
const isLocalStorageAvailable = (): boolean => {
  try {
    const testKey = "__test__";
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

// Helper to safely get stored values from localStorage or fallback to memory storage
const getStoredValue = <T,>(key: string, defaultValue: T): T => {
  try {
    if (isLocalStorageAvailable()) {
      const storedValue = localStorage.getItem(key);
      if (storedValue !== null) {
        return JSON.parse(storedValue) as T;
      }
    } else {
      // Use in-memory storage fallback
      const storedValue = memoryStorage[key];
      if (storedValue !== undefined) {
        return JSON.parse(storedValue) as T;
      }
    }
  } catch (error) {
    console.warn('Error loading from storage:', error);
  }
  return defaultValue;
};

// Helper to safely store values in localStorage or fallback to memory storage
const storeValue = <T,>(key: string, value: T): void => {
  try {
    const valueString = JSON.stringify(value);
    if (isLocalStorageAvailable()) {
      localStorage.setItem(key, valueString);
    } else {
      // Use in-memory storage fallback
      memoryStorage[key] = valueString;
    }
  } catch (error) {
    console.warn('Error saving to storage:', error);
  }
};

// Helper to clear storage (both localStorage and memory fallback)
const clearStorage = (): void => {
  try {
    if (isLocalStorageAvailable()) {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    }
    // Clear memory storage as well
    Object.values(STORAGE_KEYS).forEach(key => {
      delete memoryStorage[key];
    });
  } catch (error) {
    console.warn('Error clearing storage:', error);
  }
};

const WordPressForm: React.FC<WordPressFormProps> = ({ 
  onSubmit, 
  isLoading 
}) => {
  // Initialize state from storage when available
  const [wpUrl, setWpUrl] = useState<string>(
    getStoredValue(STORAGE_KEYS.WP_URL, "")
  );
  const [recentUrls, setRecentUrls] = useState<string[]>(
    getStoredValue(STORAGE_KEYS.RECENT_URLS, [])
  );
  const [showUrlDropdown, setShowUrlDropdown] = useState<boolean>(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const [endpoint, setEndpoint] = useState<string>(
    getStoredValue(STORAGE_KEYS.ENDPOINT, "posts")
  );
  const [includeEmbedded, setIncludeEmbedded] = useState<boolean>(
    getStoredValue(STORAGE_KEYS.INCLUDE_EMBEDDED, true)
  );
  const [mappings, setMappings] = useState<{ field: string; layer: string }[]>(
    getStoredValue(STORAGE_KEYS.MAPPINGS, [
      { field: "title.rendered", layer: "Title" },
      { field: "excerpt.rendered", layer: "Excerpt" },
      { field: "content.rendered", layer: "Content" }
    ])
  );
  
  // Duplication options from storage
  const [duplicateTemplate, setDuplicateTemplate] = useState<boolean>(
    getStoredValue(STORAGE_KEYS.DUPLICATE_TEMPLATE, false)
  );
  const [templateSpacing, setTemplateSpacing] = useState<number>(
    getStoredValue(STORAGE_KEYS.TEMPLATE_SPACING, 50)
  );
  const [gridLayout, setGridLayout] = useState<boolean>(
    getStoredValue(STORAGE_KEYS.GRID_LAYOUT, false)
  );
  const [gridColumns, setGridColumns] = useState<number>(
    getStoredValue(STORAGE_KEYS.GRID_COLUMNS, 2)
  );
  
  // Other state values
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [availablePostTypes, setAvailablePostTypes] = useState<PostType[]>([]);
  const [selectedPostType, setSelectedPostType] = useState<string>("post");
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [figmaLayers, setFigmaLayers] = useState<FigmaLayer[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>(
    getStoredValue(STORAGE_KEYS.LAST_CONNECTION, "")
  );
  const [showFieldSuggestions, setShowFieldSuggestions] = useState<number | null>(null);
  const [showLayerSuggestions, setShowLayerSuggestions] = useState<number | null>(null);
  const [fieldSearch, setFieldSearch] = useState<string>("");
  const [layerSearch, setLayerSearch] = useState<string>("");

  // Handle clicks outside of the URL dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (urlInputRef.current && !urlInputRef.current.contains(event.target as Node)) {
        setShowUrlDropdown(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [urlInputRef]);

  // Save state to storage when values change
  useEffect(() => {
    storeValue(STORAGE_KEYS.WP_URL, wpUrl);
    
    // Add to recent URLs list if it's a valid URL and not already in the list
    if (wpUrl && wpUrl.includes('.') && wpUrl.length > 5) {
      const updatedUrls = recentUrls.filter(url => url !== wpUrl);
      updatedUrls.unshift(wpUrl); // Add to the beginning
      
      // Limit to 10 recent URLs
      const limitedUrls = updatedUrls.slice(0, 10);
      setRecentUrls(limitedUrls);
      storeValue(STORAGE_KEYS.RECENT_URLS, limitedUrls);
    }
  }, [wpUrl]);

  useEffect(() => {
    storeValue(STORAGE_KEYS.ENDPOINT, endpoint);
  }, [endpoint]);

  useEffect(() => {
    storeValue(STORAGE_KEYS.INCLUDE_EMBEDDED, includeEmbedded);
  }, [includeEmbedded]);

  useEffect(() => {
    storeValue(STORAGE_KEYS.MAPPINGS, mappings);
  }, [mappings]);

  useEffect(() => {
    storeValue(STORAGE_KEYS.DUPLICATE_TEMPLATE, duplicateTemplate);
  }, [duplicateTemplate]);

  useEffect(() => {
    storeValue(STORAGE_KEYS.TEMPLATE_SPACING, templateSpacing);
  }, [templateSpacing]);

  useEffect(() => {
    storeValue(STORAGE_KEYS.GRID_LAYOUT, gridLayout);
  }, [gridLayout]);

  useEffect(() => {
    storeValue(STORAGE_KEYS.GRID_COLUMNS, gridColumns);
  }, [gridLayout]);

  useEffect(() => {
    storeValue(STORAGE_KEYS.LAST_CONNECTION, connectionStatus);
  }, [connectionStatus]);

  // Listen for messages from the plugin code
  useEffect(() => {
    window.onmessage = (event) => {
      const message = event.data.pluginMessage;
      if (message && message.type === 'available-layers') {
        setFigmaLayers(message.layers || []);
      }
    };

    // Request available layers from Figma when the component mounts
    requestFigmaLayers();
    
    // If we have a stored WordPress URL, try to auto-connect
    if (wpUrl && !isConnecting && !connectionStatus) {
      testWordPressConnection();
    }
  }, []);

  // Handle URL selection from dropdown
  const handleUrlSelect = (url: string) => {
    setWpUrl(url);
    setShowUrlDropdown(false);
    
    // If we select a new URL and it's different from the current one, 
    // reset the connection status and try to connect
    if (url !== wpUrl) {
      setConnectionStatus("");
      setTimeout(() => {
        testWordPressConnection();
      }, 100);
    }
  };

  // Request available layers from Figma
  const requestFigmaLayers = () => {
    parent.postMessage({
      pluginMessage: {
        type: 'get-available-layers'
      }
    }, '*');
  };

  // Test the WordPress connection and discover API features
  const testWordPressConnection = async () => {
    if (!wpUrl) return;

    setIsConnecting(true);
    setConnectionStatus("Connecting to WordPress...");

    try {
      // Normalize the URL 
      const normalizedUrl = wpUrl.endsWith('/')
        ? wpUrl
        : `${wpUrl}/`;

      // Check if WordPress REST API is available
      const apiResponse = await fetch(`${normalizedUrl}wp-json/`);
      
      if (!apiResponse.ok) {
        throw new Error("WordPress REST API not available at this URL");
      }

      // Fetch available post types
      const postTypesResponse = await fetch(`${normalizedUrl}wp-json/wp/v2/types`);
      
      if (!postTypesResponse.ok) {
        throw new Error("Failed to fetch post types");
      }
      
      const postTypesData = await postTypesResponse.json();
      
      // Convert to array of PostType objects
      const postTypes: PostType[] = Object.values(postTypesData).map((type: any) => ({
        slug: type.slug,
        name: type.name,
        rest_base: type.rest_base
      }));
      
      setAvailablePostTypes(postTypes);
      setConnectionStatus(`Connected to WordPress! Found ${postTypes.length} post types.`);
      
      // Set default post type if available
      if (postTypes.length > 0) {
        // Prefer 'post' if available, otherwise use the first one
        const defaultType = postTypes.find(pt => pt.slug === 'post') || postTypes[0];
        setSelectedPostType(defaultType.rest_base);
        setEndpoint(defaultType.rest_base);
        
        // Fetch sample data to discover fields
        await discoverFields(normalizedUrl, defaultType.rest_base);
      }
    } catch (error) {
      setConnectionStatus(`Error: ${error.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Clear all stored data
  const clearStoredData = () => {
    // Ask for confirmation
    if (confirm('Are you sure you want to clear all saved data?')) {
      clearStorage();
      
      // Reset state values to defaults
      setWpUrl('');
      setRecentUrls([]);
      setEndpoint('posts');
      setIncludeEmbedded(true);
      setMappings([
        { field: "title.rendered", layer: "Title" },
        { field: "excerpt.rendered", layer: "Excerpt" },
        { field: "content.rendered", layer: "Content" }
      ]);
      setDuplicateTemplate(false);
      setTemplateSpacing(50);
      setGridLayout(false);
      setGridColumns(2);
      setConnectionStatus('');
      setAvailablePostTypes([]);
      setAvailableFields([]);
      
      alert('All saved data has been cleared!');
    }
  };

  // Discover available fields from a post type
  const discoverFields = async (baseUrl: string, postTypeEndpoint: string) => {
    try {
      setConnectionStatus(`Discovering fields for ${postTypeEndpoint}...`);
      
      // Fetch a sample post to discover fields
      const sampleResponse = await fetch(
        `${baseUrl}wp-json/wp/v2/${postTypeEndpoint}?_embed&per_page=1`
      );
      
      if (!sampleResponse.ok) {
        throw new Error(`Failed to fetch sample ${postTypeEndpoint}`);
      }
      
      const samples = await sampleResponse.json();
      
      if (samples.length === 0) {
        setConnectionStatus(`No ${postTypeEndpoint} found to analyze fields.`);
        return;
      }
      
      // Extract all field names including nested ones
      const sample = samples[0];
      const fields = extractAllFields(sample);
      
      setAvailableFields(fields);
      setConnectionStatus(`Success! Found ${fields.length} fields in ${postTypeEndpoint}.`);
      
      // Set some default mappings based on common fields
      const defaultMappings = [
        { field: "title.rendered", layer: "Title" },
        { field: "content.rendered", layer: "Content" },
        { field: "excerpt.rendered", layer: "Excerpt" }
      ];
      
      // Add meta fields if available
      if (sample.meta) {
        Object.keys(sample.meta).forEach(metaKey => {
          defaultMappings.push({ field: `meta.${metaKey}`, layer: metaKey });
        });
      }
      
      // Update mappings if we have new defaults and user hasn't set custom ones
      if (defaultMappings.length > 0 && mappings.length <= 3) {
        setMappings(defaultMappings);
      }
    } catch (error) {
      setConnectionStatus(`Error discovering fields: ${error.message}`);
    }
  };

  // Extract all fields from an object recursively
  const extractAllFields = (obj: any, prefix: string = ""): string[] => {
    if (!obj || typeof obj !== 'object') return [];
    
    const fields: string[] = [];
    
    Object.entries(obj).forEach(([key, value]) => {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      
      // Don't go too deep into the object to avoid infinite recursion
      // and extremely long lists of fields
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && prefix.split('.').length < 2) {
        fields.push(fieldPath);
        fields.push(...extractAllFields(value, fieldPath));
      } else {
        fields.push(fieldPath);
      }
    });
    
    return fields;
  };
  
  // Handle post type change
  const handlePostTypeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPostType = e.target.value;
    setSelectedPostType(newPostType);
    setEndpoint(newPostType);
    
    if (wpUrl) {
      const normalizedUrl = wpUrl.endsWith('/') ? wpUrl : `${wpUrl}/`;
      await discoverFields(normalizedUrl, newPostType);
    }
  };

  const handleAddMapping = () => {
    setMappings([...mappings, { field: "", layer: "" }]);
  };

  const handleRemoveMapping = (index: number) => {
    const newMappings = [...mappings];
    newMappings.splice(index, 1);
    setMappings(newMappings);
  };

  const handleMappingChange = (
    index: number, 
    key: "field" | "layer", 
    value: string
  ) => {
    const newMappings = [...mappings];
    newMappings[index][key] = value;
    setMappings(newMappings);
    
    // For autocomplete purposes
    if (key === "field") {
      setFieldSearch(value);
      setShowFieldSuggestions(index);
    } else if (key === "layer") {
      setLayerSearch(value);
      setShowLayerSuggestions(index);
    }
  };
  
  // Handle field suggestion selection
  const handleFieldSuggestionClick = (index: number, field: string) => {
    const newMappings = [...mappings];
    newMappings[index].field = field;
    setMappings(newMappings);
    setShowFieldSuggestions(null);
  };
  
  // Handle layer suggestion selection
  const handleLayerSuggestionClick = (index: number, layer: string) => {
    const newMappings = [...mappings];
    newMappings[index].layer = layer;
    setMappings(newMappings);
    setShowLayerSuggestions(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prepare endpoint with embedded feature if needed
    let finalEndpoint = endpoint;
    if (includeEmbedded) {
      finalEndpoint += "?_embed";
    }
    
    // Convert mappings array to object
    const mappingsObject: Record<string, string> = {};
    mappings.forEach(({ field, layer }) => {
      if (field && layer) {
        mappingsObject[field] = layer;
      }
    });
    
    // Prepare duplication options if enabled
    const duplicationOptions = duplicateTemplate ? {
      duplicateTemplate,
      templateSpacing,
      gridLayout,
      gridColumns
    } : undefined;
    
    onSubmit(wpUrl, finalEndpoint, mappingsObject, duplicationOptions);
  };
  
  // Filter suggestions based on search text
  const getFilteredFieldSuggestions = (index: number) => {
    if (!availableFields.length) return [];
    
    const searchText = mappings[index]?.field.toLowerCase() || "";
    return availableFields
      .filter(field => field.toLowerCase().includes(searchText))
      .slice(0, 5); // Limit to 5 suggestions for better UI
  };
  
  const getFilteredLayerSuggestions = (index: number) => {
    if (!figmaLayers.length) return [];
    
    const searchText = mappings[index]?.layer.toLowerCase() || "";
    return figmaLayers
      .filter(layer => layer.name.toLowerCase().includes(searchText))
      .slice(0, 5); // Limit to 5 suggestions
  };
  
  // Filter recent URLs based on current input
  const getFilteredRecentUrls = () => {
    if (!recentUrls.length) return [];
    
    const searchText = wpUrl.toLowerCase();
    return recentUrls
      .filter(url => url.toLowerCase().includes(searchText));
  };

  return (
    <div className="wordpress-form">
      <div className="toolbar">
        <span></span>
        <button
          type="button"
          className="clear-data-btn"
          onClick={clearStoredData}
          title="Clear all saved settings"
        >
          Reset Saved Data
        </button>
      </div>
      
      <div className="section-container">
        <div className="form-group">
          <label htmlFor="wpUrl">WordPress URL</label>
        <div className="url-connect-group">
          <div className="url-dropdown-container" ref={urlInputRef}>
          <input
            id="wpUrl"
            type="url"
            value={wpUrl}
            onChange={(e) => setWpUrl(e.target.value)}
              onFocus={() => setShowUrlDropdown(true)}
            placeholder="https://example.com"
            required
          />
            {recentUrls.length > 0 && (
              <button 
                type="button"
                className="url-dropdown-toggle"
                onClick={() => setShowUrlDropdown(!showUrlDropdown)}
                title="Show recent WordPress URLs"
              >
                ▼
              </button>
            )}
            {showUrlDropdown && recentUrls.length > 0 && (
              <div className="url-dropdown">
                {getFilteredRecentUrls().map((url, index) => (
                  <div 
                    key={index} 
                    className="url-item"
                    onClick={() => handleUrlSelect(url)}
                  >
                    {url}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button 
            type="button"
            className="connect-btn"
            onClick={testWordPressConnection}
            disabled={isConnecting || !wpUrl}
          >
            {isConnecting ? "Connecting..." : "Connect"}
          </button>
        </div>
        <div className="form-group">
        {connectionStatus && <p className="connection-status">{connectionStatus}</p>}
        </div>
        </div>
      </div>
        
      <form onSubmit={handleSubmit}>
        {availablePostTypes.length > 0 && (
        <div className="section-container">
          <div className="form-group">
            <label htmlFor="postType">Post Type</label>
            <select
              id="postType"
              value={selectedPostType}
              onChange={handlePostTypeChange}
            >
              {availablePostTypes.map(type => (
                <option key={type.slug} value={type.rest_base}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={includeEmbedded}
                onChange={(e) => setIncludeEmbedded(e.target.checked)}
              />
              Include featured media (recommended)
            </label>
            <p className="hint">
              Enables featured images and other embedded content
            </p>
          </div>
        </div>
        )}
        
        <div className="section-container">
          <div className="form-group checkbox-group">
            <h3>Template Options</h3>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={duplicateTemplate}
                onChange={(e) => setDuplicateTemplate(e.target.checked)}
              />
              Duplicate selected component for each item
            </label>
            <p className="hint">
              Creates a copy of the selected node for each WordPress item
            </p>
          </div>
          
          {duplicateTemplate && (
            <div className="template-options">
              <div className="form-group">
                <label htmlFor="templateSpacing">Spacing between items (px)</label>
                <input
                  id="templateSpacing"
                  type="number"
                  min="0"
                  max="500"
                  value={templateSpacing}
                  onChange={(e) => setTemplateSpacing(parseInt(e.target.value) || 50)}
                />
              </div>
              
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={gridLayout}
                    onChange={(e) => setGridLayout(e.target.checked)}
                  />
                  Use grid layout
                </label>
              </div>
              
              {gridLayout && (
                <div className="form-group">
                  <label htmlFor="gridColumns">Columns</label>
                  <input
                    id="gridColumns"
                    type="number"
                    min="1"
                    max="10"
                    value={gridColumns}
                    onChange={(e) => setGridColumns(parseInt(e.target.value) || 2)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="section-container">
          <div className="form-group">
            <h3>Field to Layer Mappings</h3>
            <p className="hint">
              Map WordPress data fields to your Figma layer names
            </p>
          </div>
          {mappings.map((mapping, index) => (
            <div key={index} className="mapping-row">
              <div className="mapping-field">
                <div className="autocomplete-container">
                <input
                  type="text"
                  value={mapping.field}
                  onChange={(e) => 
                    handleMappingChange(index, "field", e.target.value)
                  }
                    onFocus={() => setShowFieldSuggestions(index)}
                  placeholder="WP Field (e.g. title.rendered)"
                />
                  {showFieldSuggestions === index && availableFields.length > 0 && (
                    <div className="suggestions">
                      {getFilteredFieldSuggestions(index).map(field => (
                        <div 
                          key={field} 
                          className="suggestion-item"
                          onClick={() => handleFieldSuggestionClick(index, field)}
                        >
                          {field}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="mapping-arrow">→</div>
              <div className="mapping-layer">
                <div className="autocomplete-container">
                <input
                  type="text"
                  value={mapping.layer}
                  onChange={(e) => 
                    handleMappingChange(index, "layer", e.target.value)
                  }
                    onFocus={() => setShowLayerSuggestions(index)}
                  placeholder="Figma Layer Name"
                />
                  {showLayerSuggestions === index && figmaLayers.length > 0 && (
                    <div className="suggestions">
                      {getFilteredLayerSuggestions(index).map(layer => (
                        <div 
                          key={layer.name} 
                          className="suggestion-item"
                          onClick={() => handleLayerSuggestionClick(index, layer.name)}
                        >
                          {layer.name} <span className="layer-type">({layer.type})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="remove-btn"
                onClick={() => handleRemoveMapping(index)}
              >
                ✕
              </button>
            </div>
          ))}
          
          <div className="form-group">
            <button 
              type="button" 
              className="add-mapping-btn" 
              onClick={handleAddMapping}
            >
              + Add Mapping
            </button>
          </div>
        </div>
        
        <div className="section-container">
          <div className="form-group">
            <button 
              type="submit" 
              className="submit-btn" 
              disabled={isLoading || !wpUrl || mappings.length === 0}
            >
              {isLoading ? "Loading..." : duplicateTemplate ? "Fetch, Clone & Populate" : "Fetch & Populate"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default WordPressForm; 