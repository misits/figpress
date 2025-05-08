figma.showUI(__html__, { themeColors: true, height: 600, width: 450 });

// Define message types
interface WordPressData {
  title?: string | { rendered: string };
  content?: string | { rendered: string };
  excerpt?: string | { rendered: string };
  meta?: Record<string, any>;
  featured_media?: number;
  _embedded?: {
    'wp:featuredmedia'?: Array<{
      source_url?: string;
      media_details?: {
        sizes?: {
          medium?: {
            source_url?: string;
          };
          full?: {
            source_url?: string;
          };
        };
      };
    }>;
  };
  [key: string]: any;
}

interface PluginMessage {
  type: 'fetch-wordpress-data' | 'populate-layers' | 'notify' | 'get-available-layers';
  wordpressUrl?: string;
  endpoint?: string;
  layerMappings?: Record<string, string>;
  data?: WordPressData[];
  message?: string;
  duplicateTemplate?: boolean;
  templateSpacing?: number;
  gridLayout?: boolean;
  gridColumns?: number;
  selectedItems?: number[];
}

interface FigmaLayer {
  name: string;
  type: string;
  id: string;
}

// Handle messages from the UI
figma.ui.onmessage = async (msg: PluginMessage) => {
  if (msg.type === 'get-available-layers') {
    // Send available layers to the UI
    const layers = collectAvailableLayers();
    figma.ui.postMessage({ 
      type: 'available-layers', 
      layers 
    });
  }
  else if (msg.type === 'fetch-wordpress-data') {
    // UI is handling the actual fetch, this is just a notification
    console.log('WordPress data fetch requested');
  } 
  else if (msg.type === 'populate-layers' && msg.data) {
    try {
      if (msg.duplicateTemplate) {
        await duplicateAndPopulateLayers(
          msg.data, 
          msg.layerMappings || {}, 
          msg.templateSpacing || 50,
          msg.gridLayout || false,
          msg.gridColumns || 1
        );
      } else {
        await populateLayers(msg.data, msg.layerMappings || {});
      }
      
      figma.ui.postMessage({ 
        type: 'notify', 
        message: 'Layers successfully populated!' 
      });
    } catch (error) {
      figma.ui.postMessage({ 
        type: 'notify', 
        message: `Error populating layers: ${error.message}` 
      });
    }
  }
  else if (msg.type === 'notify') {
    figma.notify(msg.message || 'Operation completed');
  }
};

// New function to duplicate and populate components/layers
async function duplicateAndPopulateLayers(
  wpData: WordPressData[],
  layerMappings: Record<string, string>,
  spacing: number = 50,
  gridLayout: boolean = false,
  gridColumns: number = 1
) {
  // Load fonts first
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  
  // Check if we have a selection to use as template
  if (figma.currentPage.selection.length === 0) {
    figma.notify('Please select a node to use as template');
    return;
  }
  
  // Use the first selected node as our template
  const templateNode = figma.currentPage.selection[0];
  const parentFrame = templateNode.parent;
  
  if (!parentFrame) {
    figma.notify('Template node must have a parent');
    return;
  }
  
  // Calculate the template dimensions
  let templateWidth = 0;
  let templateHeight = 0;
  
  if ('width' in templateNode && 'height' in templateNode) {
    templateWidth = templateNode.width;
    templateHeight = templateNode.height;
  }
  
  // Store the original position
  let originalX = 0;
  let originalY = 0;
  
  if ('x' in templateNode && 'y' in templateNode) {
    originalX = templateNode.x;
    originalY = templateNode.y;
  }
  
  // Create a group to hold all the duplicates if needed
  let container = parentFrame;
  
  // Calculate grid parameters if using grid layout
  const itemsPerRow = gridLayout ? gridColumns : 1;
  const columnWidth = templateWidth + spacing;
  const rowHeight = templateHeight + spacing;
  
  // Duplicate the template for each WordPress data item
  for (let i = 0; i < wpData.length; i++) {
    // Skip the first one if it's our template
    if (i === 0) {
      // Populate the template with the first data item
      await populateNode(templateNode, wpData[i], layerMappings);
      continue;
    }
    
    // Clone the template if it's a supported node type
    let clone: SceneNode | null = null;
    
    try {
      // Only certain node types can be cloned
      if ('clone' in templateNode) {
        clone = templateNode.clone();
      } else {
        figma.notify(`Cannot clone node of type ${templateNode.type}`);
        continue;
      }
      
      // Add to parent
      if (clone && 'appendChild' in parentFrame) {
        parentFrame.appendChild(clone);
      }
      
      // Position the clone based on layout type
      if (clone && 'x' in clone && 'y' in clone) {
        if (gridLayout) {
          // Calculate grid position
          const row = Math.floor(i / itemsPerRow);
          const col = i % itemsPerRow;
          
          clone.x = originalX + (col * columnWidth);
          clone.y = originalY + (row * rowHeight);
        } else {
          // Linear layout (vertical stack)
          clone.x = originalX;
          clone.y = originalY + (i * (templateHeight + spacing));
        }
      }
      
      // Populate the clone with data
      if (clone) {
        await populateNode(clone, wpData[i], layerMappings);
      }
    } catch (error) {
      figma.notify(`Error duplicating template: ${error.message}`);
    }
  }
  
  // Notify completion
  figma.notify(`Created and populated ${wpData.length} items`);
}

// Helper to populate a specific node and its children
async function populateNode(
  node: SceneNode, 
  dataItem: WordPressData, 
  layerMappings: Record<string, string>
) {
  // Process each mapping (WordPress field → Figma layer name)
  for (const [wpField, layerName] of Object.entries(layerMappings)) {
    // Find layers by name within this node
    const layers = findLayersByNameInNode(node, layerName);
    
    // Try to get the field value using dot notation path
    const fieldValue = getNestedValue(dataItem, wpField);
    
    if (fieldValue !== undefined) {
      // Apply the value to all matching layers
      for (const layer of layers) {
        await applyDataToLayer(layer, fieldValue, wpField);
      }
    }
  }
  
  // Try to find and populate image layers
  const imageUrl = extractImageUrl(dataItem);
  if (imageUrl) {
    const imageLayers = findPotentialImageLayersInNode(node);
    for (const layer of imageLayers) {
      await applyImageToLayer(layer, imageUrl);
    }
  }
}

// Helper to find layers by name within a specific node
function findLayersByNameInNode(node: SceneNode, name: string): SceneNode[] {
  const result: SceneNode[] = [];
  
  // Check if this node matches
  if (node.name === name) {
    result.push(node);
  }
  
  // Check children if node has them
  if ('children' in node) {
    for (const child of node.children) {
      result.push(...findLayersByNameInNode(child as SceneNode, name));
    }
  }
  
  return result;
}

// Helper to find potential image layers within a specific node
function findPotentialImageLayersInNode(node: SceneNode): SceneNode[] {
  const result: SceneNode[] = [];
  
  // Check if this node is a potential image layer
  const name = node.name.toLowerCase();
  if (
    (name.includes('image') || 
    name.includes('img') || 
    name.includes('photo') || 
    name.includes('pic') || 
    name.includes('thumbnail') ||
    name.includes('featured')) &&
    (node.type === 'RECTANGLE' || node.type === 'ELLIPSE' || node.type === 'FRAME')
  ) {
    result.push(node);
  }
  
  // Check children if node has them
  if ('children' in node) {
    for (const child of node.children) {
      result.push(...findPotentialImageLayersInNode(child as SceneNode));
    }
  }
  
  return result;
}

// Collect all available layers from the current selection or page
function collectAvailableLayers(): FigmaLayer[] {
  const layers: FigmaLayer[] = [];
  
  // Start with the selected nodes or use the current page
  const selection = figma.currentPage.selection;
  const targetNodes = selection.length > 0 ? selection : [figma.currentPage];
  
  // Process each target node
  for (const node of targetNodes) {
    collectLayersRecursively(node, layers);
  }
  
  return layers;
}

// Recursively collect layers from a node and its children
function collectLayersRecursively(node: BaseNode, layers: FigmaLayer[]) {
  // Add the current node if it's a valid layer type
  if ('name' in node && node.type !== 'DOCUMENT') {
    layers.push({
      name: node.name,
      type: node.type,
      id: node.id
    });
  }
  
  // Process children if the node has any
  if ('children' in node) {
    for (const child of node.children) {
      collectLayersRecursively(child, layers);
    }
  }
}

// Helper function to extract content from WordPress field
function extractContent(field: any): string {
  if (typeof field === 'object' && field?.rendered) {
    return field.rendered;
  } else if (typeof field === 'string') {
    return field;
  } else if (field === null || field === undefined) {
    return '';
  }
  
  // Convert to string if it's a number or boolean
  return String(field);
}

// Helper to extract image URL from WordPress data
function extractImageUrl(item: WordPressData): string | null {
  // Check for embedded featured media
  if (item._embedded && item._embedded['wp:featuredmedia']?.[0]) {
    const media = item._embedded['wp:featuredmedia'][0];
    
    // Try to get medium size first, then full size
    if (media.media_details?.sizes?.medium?.source_url) {
      return media.media_details.sizes.medium.source_url;
    } else if (media.media_details?.sizes?.full?.source_url) {
      return media.media_details.sizes.full.source_url;
    } else if (media.source_url) {
      return media.source_url;
    }
  }
  
  // Check for direct featured_image_url property
  if (item.featured_image_url) {
    return item.featured_image_url;
  }
  
  return null;
}

// Function to get a nested property value from an object using a dot-notation path
function getNestedValue(obj: any, path: string): any {
  if (!path) return undefined;
  
  const parts = path.split('.');
  let value = obj;
  
  for (const part of parts) {
    if (value === null || value === undefined || typeof value !== 'object') {
      return undefined;
    }
    value = value[part];
  }
  
  return value;
}

// Function to populate Figma layers with WordPress data
async function populateLayers(
  wpData: WordPressData[], 
  layerMappings: Record<string, string>
) {
  // Load fonts first
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  
  // Get selected nodes or use the current page
  const selection = figma.currentPage.selection;
  const targetNodes = selection.length > 0 ? selection : [figma.currentPage];
  
  // For each WordPress data item
  for (let i = 0; i < wpData.length; i++) {
    const dataItem = wpData[i];
    const targetNode = targetNodes[Math.min(i, targetNodes.length - 1)];
    
    // Process each mapping (WordPress field → Figma layer name)
    for (const [wpField, layerName] of Object.entries(layerMappings)) {
      // Find layers by name recursively
      const layers = findLayersByName(targetNode, layerName);
      
      // Try to get the field value using dot notation path
      const fieldValue = getNestedValue(dataItem, wpField);
      
      if (fieldValue !== undefined) {
        // Apply the value to all matching layers
        for (const layer of layers) {
          await applyDataToLayer(layer, fieldValue, wpField);
        }
      }
    }
    
    // Try to find image layers and populate them
    const imageUrl = extractImageUrl(dataItem);
    if (imageUrl) {
      // Find layers that are likely to be image containers
      const imageLayers = findPotentialImageLayers(targetNode);
      for (const layer of imageLayers) {
        await applyImageToLayer(layer, imageUrl);
      }
    }
  }
}

// Apply data to a layer based on its type
async function applyDataToLayer(layer: SceneNode, data: any, fieldName: string) {
  if (layer.type === 'TEXT') {
    // For text layers, set the text content
    let textContent = '';
    
    if (typeof data === 'object' && data?.rendered) {
      // Handle rendered content from WordPress
      textContent = data.rendered;
    } else {
      // Handle other types of data
      textContent = extractContent(data);
    }
    
    // If the data is HTML (likely from rendered content)
    if (typeof textContent === 'string' && textContent.includes('<')) {
      // Basic HTML stripping for rendered content
      textContent = textContent.replace(/<[^>]*>/g, '');
    }
    
    layer.characters = textContent;
  } 
  else if (
    (layer.type === 'RECTANGLE' || layer.type === 'ELLIPSE' || layer.type === 'FRAME') && 
    (fieldName.includes('image') || fieldName.includes('media') || fieldName.includes('featured'))
  ) {
    // For container layers that are mapped to image fields
    if (typeof data === 'string') {
      await applyImageToLayer(layer, data);
    }
  }
}

// Apply an image to a layer from a URL
async function applyImageToLayer(layer: SceneNode, imageUrl: string) {
  try {
    // Only apply to compatible node types
    if (layer.type === 'RECTANGLE' || layer.type === 'ELLIPSE' || layer.type === 'FRAME') {
      figma.notify(`Attempting to load image from: ${imageUrl}`);
      
      // Image fill isn't directly supported here - we need to notify the user
      figma.notify('Image loading will be handled in future iterations.');
      
      // In a full implementation, we would:
      // 1. Fetch the image data
      // 2. Create an image fill
      // 3. Apply it to the layer
    }
  } catch (error) {
    figma.notify(`Failed to apply image: ${error.message}`);
  }
}

// Find layers that are likely to be image containers
function findPotentialImageLayers(node: BaseNode): SceneNode[] {
  const result: SceneNode[] = [];
  
  if ('children' in node) {
    for (const child of node.children) {
      // Identify potential image containers by name patterns
      const name = child.name.toLowerCase();
      if (
        name.includes('image') || 
        name.includes('img') || 
        name.includes('photo') || 
        name.includes('pic') || 
        name.includes('thumbnail') ||
        name.includes('featured')
      ) {
        if (
          child.type === 'RECTANGLE' || 
          child.type === 'ELLIPSE' || 
          child.type === 'FRAME'
        ) {
          result.push(child as SceneNode);
        }
      }
      
      // Recurse into children
      if ('children' in child) {
        result.push(...findPotentialImageLayers(child));
      }
    }
  }
  
  return result;
}

// Helper function to find layers by name recursively
function findLayersByName(node: BaseNode, name: string): SceneNode[] {
  const result: SceneNode[] = [];
  
  if ('children' in node) {
    for (const child of node.children) {
      if (child.name === name) {
        result.push(child as SceneNode);
      }
      if ('children' in child) {
        result.push(...findLayersByName(child, name));
      }
    }
  }
  
  return result;
}
