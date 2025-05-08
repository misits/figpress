import * as React from "react";
import * as ReactDOM from "react-dom/client";
import "./styles/ui.css";
import Header from "./components/Layouts/Header";
import Footer from "./components/Layouts/Footer";
import WordPressForm from "./components/WordPressForm";
import { useState } from "react";

// Define data types
interface WordPressData {
  title?: string | { rendered: string };
  content?: string | { rendered: string };
  excerpt?: string | { rendered: string };
  featuredImage?: string;
  [key: string]: any;
}

interface PluginMessage {
  type: string;
  wordpressUrl?: string;
  endpoint?: string;
  layerMappings?: Record<string, string>;
  data?: WordPressData[];
  message?: string;
  selectedItems?: number[];
}

// Define duplication options
interface DuplicationOptions {
  duplicateTemplate: boolean;
  templateSpacing: number;
  gridLayout: boolean;
  gridColumns: number;
}

function App() {
  const [status, setStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [wpData, setWpData] = useState<WordPressData[]>([]);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [layerMappings, setLayerMappings] = useState<Record<string, string>>({});
  
  // Add state for duplication options
  const [duplicateTemplate, setDuplicateTemplate] = useState<boolean>(false);
  const [templateSpacing, setTemplateSpacing] = useState<number>(50);
  const [gridLayout, setGridLayout] = useState<boolean>(false);
  const [gridColumns, setGridColumns] = useState<number>(2);

  // Listen for messages from the plugin code
  React.useEffect(() => {
    window.onmessage = (event) => {
      const message = event.data.pluginMessage as PluginMessage;
      if (message.type === 'notify') {
        setStatus(message.message || '');
        setIsLoading(false);
      }
    };
  }, []);

  // Function to fetch data from WordPress
  const fetchWordPressData = async (
    wpUrl: string, 
    endpoint: string
  ): Promise<WordPressData[]> => {
    try {
      setIsLoading(true);
      setStatus("Fetching data from WordPress...");
      
      // Construct the API URL
      const apiUrl = wpUrl.endsWith('/')
        ? `${wpUrl}wp-json/wp/v2/${endpoint}`
        : `${wpUrl}/wp-json/wp/v2/${endpoint}`;
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStatus(`Successfully fetched ${data.length} items from WordPress!`);
      
      // By default, select all items
      const newSelectedItems = data.map((_, index) => index);
      setSelectedItems(newSelectedItems);
      
      return data;
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleFormSubmit = async (
    wpUrl: string, 
    endpoint: string, 
    mappings: Record<string, string>,
    duplicationOptions?: DuplicationOptions
  ) => {
    // Save the mappings for later use
    setLayerMappings(mappings);
    
    // Save duplication options if provided
    if (duplicationOptions) {
      setDuplicateTemplate(duplicationOptions.duplicateTemplate);
      setTemplateSpacing(duplicationOptions.templateSpacing);
      setGridLayout(duplicationOptions.gridLayout);
      setGridColumns(duplicationOptions.gridColumns);
    }
    
    // Notify plugin about data fetching
    parent.postMessage({
      pluginMessage: {
        type: 'fetch-wordpress-data',
        wordpressUrl: wpUrl,
        endpoint
      }
    }, '*');
    
    // Fetch the actual data
    const data = await fetchWordPressData(wpUrl, endpoint);
    setWpData(data);
  };

  // Handle populate button click
  const handlePopulate = () => {
    if (wpData.length === 0 || selectedItems.length === 0) return;
    
    // Filter data to include only selected items
    const selectedData = selectedItems.map(index => wpData[index]);
    
    // Send data to plugin for population
    parent.postMessage({
      pluginMessage: {
        type: 'populate-layers',
        data: selectedData,
        layerMappings, // Use the saved mappings
        selectedItems,
        // Add duplication options
        duplicateTemplate,
        templateSpacing,
        gridLayout,
        gridColumns
      }
    }, '*');
    
    setStatus(`Populating layers with ${selectedData.length} selected items...`);
  };

  // Toggle item selection
  const toggleItemSelection = (index: number) => {
    if (selectedItems.includes(index)) {
      setSelectedItems(selectedItems.filter(i => i !== index));
    } else {
      setSelectedItems([...selectedItems, index].sort((a, b) => a - b));
    }
  };

  // Select all items
  const selectAllItems = () => {
    setSelectedItems(wpData.map((_, index) => index));
  };

  // Deselect all items
  const deselectAllItems = () => {
    setSelectedItems([]);
  };

  // Helper function to get title text from WordPress data
  const getTitleText = (item: WordPressData, index: number): string => {
    if (typeof item.title === 'object' && item.title?.rendered) {
      return item.title.rendered;
    } else if (typeof item.title === 'string') {
      return item.title;
    }
    return `Item ${index + 1}`;
  };

  // Helper to get excerpt text
  const getExcerptText = (item: WordPressData): string => {
    if (typeof item.excerpt === 'object' && item.excerpt?.rendered) {
      // Remove HTML tags
      return item.excerpt.rendered.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 80) + "...";
    } else if (typeof item.excerpt === 'string') {
      return item.excerpt.substring(0, 80) + "...";
    }
    return "";
  };

  return (
    <>
      <Header />
      <main>
        <WordPressForm 
          onSubmit={handleFormSubmit} 
          isLoading={isLoading} 
        />
        
        {status && (
          <div className="section-container">
            <div className="status-message">
              {status}
            </div>
          </div>
        )}
        
        {wpData.length > 0 && (
          <div className="section-container">
            <div className="data-preview-container">
              <div className="data-preview-header">
                <h3>Fetched {wpData.length} items</h3>
              <div className="data-actions">
                <button 
                  className="small-button" 
                  onClick={selectAllItems}
                  title="Select all items"
                >
                  Select All
                </button>
                <button 
                  className="small-button" 
                  onClick={deselectAllItems}
                  title="Deselect all items"
                >
                  Deselect All
                </button>
                <button 
                  className="populate-button" 
                  onClick={handlePopulate}
                  disabled={selectedItems.length === 0}
                  title="Populate selected items"
                >
                  Populate Selected ({selectedItems.length})
                </button>
              </div>
            </div>
            
            <div className="data-preview">
              <div className="data-list">
                {wpData.map((item, index) => (
                  <div 
                    key={index} 
                    className={`data-item ${selectedItems.includes(index) ? 'selected' : ''}`}
                    onClick={() => toggleItemSelection(index)}
                  >
                    <div className="data-item-checkbox">
                      <input 
                        type="checkbox" 
                        checked={selectedItems.includes(index)}
                        onChange={() => toggleItemSelection(index)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="data-item-content">
                      <div className="data-item-title">{getTitleText(item, index)}</div>
                      {getExcerptText(item) && (
                        <div className="data-item-excerpt">{getExcerptText(item)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        )}
      </main>
      <Footer />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("figpress-page")).render(<App />);