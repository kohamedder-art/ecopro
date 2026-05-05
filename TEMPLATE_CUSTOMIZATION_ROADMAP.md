# Template Customization Roadmap
## Hide/Show Toggle System Implementation

### Overview
Adding hide/show toggle buttons directly on template cards when in edit mode (`canManage=true`).

---

## Priority Matrix

### Tier 1: High Priority (Start First)
| Template | Sections Needing Toggles | Est. Time | Impact |
|----------|------------------------|-----------|--------|
| **NeedDZ** | Urgent countdown bar, Trust banner (3 pills), Social proof notification, Card social proof | 2-3 hrs | Very High - Most used |
| **Lumina** | Countdown timer, Trust badges | 1.5 hrs | High |
| **LuxeDrop** | ✅ DONE - Countdown, Features, Social proof | 0 hrs | - |

### Tier 2: Medium Priority
| Template | Sections Needing Toggles | Est. Time | Impact |
|----------|------------------------|-----------|--------|
| **DZPremium** | Trust sections, Feature cards | 1.5 hrs | Medium-High |
| **DZShop** | Trust badges, Hero features | 1.5 hrs | Medium-High |
| **NovaDZ** | Feature cards, Trust elements | 1.5 hrs | Medium |
| **Zenith** | Countdown, Trust badges | 1.5 hrs | Medium |

### Tier 3: Lower Priority
| Template | Sections Needing Toggles | Est. Time |
|----------|------------------------|-----------|
| **Artisan** | Trust elements, Feature cards | 1 hr |
| **Vera** | Trust/guarantee sections | 1 hr |
| **Aurora** | Feature cards | 1 hr |
| **Minimalist** | Feature section | 1 hr |
| **Gallery** | Trust elements | 1 hr |
| **Streetwear** | Feature cards | 1 hr |
| **Sculptor** | Feature cards | 1 hr |
| **JewelHeart** | Trust badges | 1 hr |
| **ClassicShop** | Feature section | 1 hr |
| **DZ3Shop** | Hardcoded elements | 1 hr |
| **IYCO** | Feature cards | 1 hr |
| **Bassem28** | Fixed sections | 1 hr |
| **LeRoiShop** | Trust elements | 1 hr |
| **Spiriluxe** | Content sections | 1 hr |
| **Boutique** | Feature cards | 1 hr |

---

## Time Estimates

### Per Template Breakdown
- **Simple template** (1-2 sections): ~1 hour
- **Medium template** (3-4 sections): ~1.5-2 hours  
- **Complex template** (5+ sections): ~2.5-3 hours

### Total Time Estimate
- **Tier 1** (3 templates): ~6 hours
- **Tier 2** (4 templates): ~6 hours
- **Tier 3** (15 templates): ~15 hours
- **Testing & Fixes**: ~4 hours
- **Documentation**: ~2 hours

**GRAND TOTAL: ~33 hours (4-5 days of focused work)**

---

## Implementation Pattern

### For Each Section Needing Toggle:

```tsx
// 1. Add visibility setting (default true to not break existing)
const showSection = settings?.template_show_section !== false;

// 2. Wrap with canManage check to show placeholder when hidden
{(showSection || canManage) && (
  <div className="... relative" data-edit-path="section-name">
    
    {/* 3. Add toggle button when in edit mode */}
    {canManage && (
      <div className="absolute -top-3 -right-3 ...">
        <button onClick={() => window.parent.postMessage({
          type: 'TEMPLATE_UPDATE_SETTING',
          key: 'template_show_section',
          value: !showSection
        }, '*')}>
          {showSection ? 'إخفاء' : 'إظهار'}
        </button>
      </div>
    )}
    
    {/* 4. Content conditionally rendered */}
    {showSection && (
      <>Actual content here</>
    )}
    
    {/* 5. Placeholder when hidden in edit mode */}
    {canManage && !showSection && (
      <p>Section hidden - click to show</p>
    )}
  </div>
)}
```

---

## Progress Tracking

| Template | Status | Sections Done | Date |
|----------|--------|---------------|------|
| LuxeDrop | ✅ DONE | 3/3 | 2026-05-04 |
| NeedDZ | ⏳ PENDING | 0/4 | - |
| Lumina | ⏳ PENDING | 0/2 | - |
| DZPremium | ⏳ PENDING | 0/2 | - |
| DZShop | ⏳ PENDING | 0/2 | - |
| NovaDZ | ⏳ PENDING | 0/2 | - |
| Zenith | ⏳ PENDING | 0/2 | - |
| (remaining) | ⏳ PENDING | - | - |

---

## Testing Checklist Per Template

- [ ] Toggle appears in edit mode
- [ ] Hide button works (section disappears from storefront)
- [ ] Show button works (section reappears)
- [ ] Placeholder visible when hidden in edit mode
- [ ] Settings persist after save
- [ ] No console errors
- [ ] Mobile preview works
- [ ] Desktop preview works
