# Relationship Graph Implementation Specification

**Version:** 1.0  
**Feature:** Interactive Binding Relationship Graph  
**Target Phase:** Phase 2 (Detailed View)  
**Priority:** Enhancement  

---

## Objectives

- Add interactive graph visualization of binding relationships to Detailed View
- Display binding → products → metadata connections
- Support event updates, confirmations, and contestations visually
- Provide toolbar with search, filters, and export capabilities

---

## Technical Stack

```yaml
library: reactflow
version: "^11.0.0"
export_library: html-to-image
icons: feather_icons
resize_library: react-resizable-panels (optional)
```

---

## Integration Point

### Location
- Below all existing card sections in Detailed View
- After `BindingActivitySection`
- New component: `GraphPanel`

### Visual Hierarchy
```
DetailedView/
├─ BackButton
├─ BindingDetailsCard
├─ ProductsSection
├─ MetadataSection
├─ BindingActivitySection
└─ GraphPanel           ← NEW
    ├─ GraphToolbar
    └─ GraphVisualization
```

---

## Graph Scope

Display for a single binding:
- 1 central BindingEvent node
- N ProductEvent nodes (left side)
- M MetadataEvent nodes (right side)
- Update overlays (ghost nodes)
- Confirmation/contestation badges
- Alternative metadata nodes (if contested)

Expected total: **5-30 nodes per binding**

---

## Node Specifications

### Product Node
```yaml
shape: rectangle
border: "3px solid #2C5AA0"
background: white
dimensions: 180px × 140px
content:
  - icon: "📦"
  - product_name: bold, 14px
  - vendor: gray, 12px
  - version: 12px
  - cpe: monospace, 10px, truncated
shadow: "0 1px 3px rgba(0,0,0,0.08)"
hover_shadow: "0 2px 8px rgba(0,0,0,0.12)"
```

### Metadata Node
```yaml
shape: rectangle
border: "3px solid #FD7E14"
background: white
dimensions: 180px × 140px
content:
  - icon: "📄"
  - title: bold, 14px
  - file_type: 12px
  - hash_preview: monospace, 10px, first_8_chars
  - verified_icon: conditional
shadow: "0 1px 3px rgba(0,0,0,0.08)"
hover_shadow: "0 2px 8px rgba(0,0,0,0.12)"
```

### Binding Node
```yaml
shape: rounded_rectangle
border: "3px solid #28A745"
background: white
dimensions: 160px × 100px
content:
  - icon: "🔗"
  - label: "Binding", 14px
  - author: truncated_npub, 10px
  - indicators: "● ●"
shadow: "0 1px 3px rgba(0,0,0,0.08)"
```

### Update Overlay (Ghost)
```yaml
shape: rectangle
border: "2px dashed #FD7E14"
background: "rgba(253, 126, 20, 0.08)"
opacity: 0.6
position: "-6px -6px" (offset)
badge: "🔄" (top-right)
```

### Confirmation Badge
```yaml
shape: circle
diameter: 28px
background: "#20C997"
position: top_right
icon: "✓"
count: displayed if multiple
```

### Contestation Badge
```yaml
shape: circle
diameter: 28px
background: "#DC3545"
position: bottom_right
icon: "!"
count: displayed if multiple
```

---

## Edge Specifications

### Binding → Product
```yaml
type: smoothstep
stroke: "#2C5AA0"
width: 2px
animated: false
arrow: true
label: conditional (toggle)
```

### Binding → Metadata
```yaml
type: smoothstep
stroke: "#FD7E14"
width: 2px
animated: false
arrow: true
label: conditional (toggle)
```

### Update → Original
```yaml
type: smoothstep
stroke: "#FD7E14"
width: 2px
dash: "5,5"
arrow: true
label: "replaces" (conditional)
```

### Metadata → Alternative
```yaml
type: smoothstep
stroke: "#DC3545"
width: 2px
dash: "3,3"
arrow: true
label: "alternative" (conditional)
```

---

## Layout Algorithm

### Static Positioning (Recommended)

```javascript
GRAPH_WIDTH = 900
GRAPH_HEIGHT = 500

// Binding center
bindingX = 450
bindingY = 250

// Products (left, vertical stack)
productBaseX = 50
productSpacingY = 160
productStartY = bindingY - ((productCount - 1) * 160) / 2

// Metadata (right, vertical stack)
metadataBaseX = 700
metadataSpacingY = 160
metadataStartY = bindingY - ((metadataCount - 1) * 160) / 2

// Alternatives (below metadata)
alternativeX = 700
alternativeStartY = metadataStartY + (metadataCount * 160) + 50
```

---

## Interactive Features

### On Node Click
```javascript
// Scroll to corresponding card in Detailed View
// Add highlight animation (2s duration)
cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
cardElement.classList.add('graph-highlighted')
```

### On Node Hover
```javascript
// Display tooltip with:
// - Event type
// - Event ID (truncated)
// - Author (truncated npub)
// - Created date (relative)
```

### Right-Click Context Menu
```javascript
options = [
  "Copy Event ID",
  "Copy Author",
  "Open in Nostr",
  "View External Data" (metadata only),
  "Export as JSON"
]
```

### Search
```javascript
// Match against:
// - Event IDs
// - Content text
// - Author pubkeys
// Highlight matching nodes
```

---

## Toolbar Controls

```yaml
features:
  - SearchBar: filter nodes by text
  - LabelToggle: show/hide edge labels
  - PhysicsToggle: enable/disable force simulation (optional)
  - ExportButtons: PNG, SVG
  - ResetViewButton: reset zoom/pan
  - ExpandToggle: show/hide entire panel
```

---

## State Management

```typescript
interface GraphState {
  nodes: Node[]
  edges: Edge[]
  highlightedNodes: Set<string>
  showLabels: boolean
  physicsEnabled: boolean
  selectedNode: string | null
  contextMenu: ContextMenu | null
  isExpanded: boolean
  panelHeight: number
}
```

---

## Responsive Behavior

```yaml
desktop_1024_and_up:
  max_height: 600px
  resizable: true

tablet_768_to_1024:
  max_height: 500px
  resizable: true

mobile_below_768:
  display: none
  message: "Graph view available on desktop only"
```

---

## Implementation Checklist

### Phase 1: Basic Setup
- [ ] Install `reactflow`, `html-to-image`
- [ ] Create `GraphPanel` component
- [ ] Create `GraphVisualization` component
- [ ] Implement static layout algorithm
- [ ] Build nodes/edges from binding data
- [ ] Add zoom/pan controls

### Phase 2: Styling & Interactions
- [ ] Style nodes with card design
- [ ] Style edges with proper colors/dashes
- [ ] Implement click → scroll to card
- [ ] Add hover tooltips
- [ ] Enable node dragging
- [ ] Add context menu

### Phase 3: Features
- [ ] Search functionality
- [ ] Label toggle
- [ ] Export PNG/SVG
- [ ] Update overlays
- [ ] Confirmation/contestation badges

### Phase 4: Polish
- [ ] Physics toggle (optional)
- [ ] Resizable panel with divider
- [ ] Mobile detection + message
- [ ] Animations
- [ ] Error handling
- [ ] Performance testing

---

## Code Formatting Standards

```yaml
tool: prettier
print_width: 80
code_blocks: use triple backticks with language identifier
inline_code: use single backticks
no_dollar_prompts: commands should be copy-pasteable
```

---

## LaTeX Math Formatting

```yaml
inline: \( expression \)
display: $$ expression $$
avoid: single dollar signs
special_chars: escape properly (&, %, $, #, _, {, }, ~, ^, \)
```

---

## References

- React Flow Documentation: https://reactflow.dev
- html-to-image: https://github.com/bubkoo/html-to-image
- Feather Icons: https://feathericons.com

---

**END OF SPECIFICATION**