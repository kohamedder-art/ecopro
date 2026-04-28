Orders ​Copy link
OrdersOperations
get
/api/v2/orders/{trackingId}
get
/api/v2/orders/{trackingId}/relatives
get
/api/v2/orders/{trackingId}/status-history
post
/api/v2/orders/search
post
/api/v2/orders
post
/api/v2/orders/bulk
get
/api/v2/orders/statistics/statuses
Get Order​Copy link
Path Parameters
trackingIdCopy link to trackingId
Type:string
required
Responses

200
Success
application/json

400
Validation failed
application/json

401
Invalid Token
application/json

403
Forbidden
application/json

404
Not found
application/json

500
Internal server error
application/json
Request Example forget/api/v2/orders/{trackingId}
Shell Curl
curl 'https://api.mdm.express/api/v2/orders/{trackingId}' \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN'

Ask AI Agent

Test Request
(get /api/v2/orders/{trackingId})
Status:200
Status:400
Status:401
Status:403
Status:404
Status:500
{
  "trackingId": "string",
  "externalId": null,
  "ip": null,
  "utmSource": null,
  "currency": "string",
  "isDropShipping": true,
  "client": {
    "firstName": "string",
    "lastName": "string",
    "phone": "string",
    "phone2": null
  },
  "source": "string",
  "totalPrice": 1,
  "destination": {
    "cityId": "string",
    "cityCode": "string",
    "cityName": "string",
    "stateId": "string",
    "stateCode": "string",
    "stateName": "string",
    "countryId": "string",
    "countryCode": "string",
    "countryName": "string",
    "streetAddress": "string",
    "gps": "string"
  },
  "confirmed": true,
  "confirmedByUs": true,
  "freeShipping": true,
  "isInsuranceEnabled": true,
  "declaredValue": null,
  "isStopDesk": true,
  "stopDeskId": null,
  "paymentMethod": null,
  "openable": true,
  "liquid": true,
  "fragile": true,
  "length": 1,
  "height": 1,
  "weight": 1,
  "width": 1,
  "archived": true,
  "createdAt": "2026-04-26T12:03:52.054Z",
  "createdBy": "string",
  "updatedAt": "2026-04-26T12:03:52.054Z",
  "updatedBy": "string",
  "status": "string",
  "statusDate": "2026-04-26T12:03:52.054Z",
  "country": {
    "id": "string",
    "name": "string",
    "nameAr": "string",
    "code": "string",
    "flag": "string"
  },
  "seller": {
    "trackingId": "string",
    "firstName": "string",
    "lastName": "string"
  },
  "store": {
    "trackingId": "string",
    "name": "string",
    "logoId": null
  },
  "products": [
    {
      "trackingId": "string",
      "name": "string",
      "quantity": 1,
      "variantOf": "string",
      "description": "string",
      "images": [
        "string"
      ],
      "price": null
    }
  ],
  "relatives": [
    {
      "type": "line-item",
      "data": null
    }
  ],
  "stopDesk": {
    "id": "string",
    "name": "string",
    "address": {
      "cityId": "string",
      "cityCode": "string",
      "cityName": "string",
      "stateId": "string",
      "stateCode": "string",
      "stateName": "string",
      "countryId": "string",
      "countryCode": "string",
      "countryName": "string",
      "streetAddress": "string",
      "gps": "string"
    },
    "email": null,
    "phones": [
      "string"
    ],
    "enabled": true
  }
}

Success

Get Order Relatives​Copy link
Path Parameters
trackingIdCopy link to trackingId
Type:string
required
Responses

200
Success
application/json

400
Validation failed
application/json

401
Invalid Token
application/json

403
Forbidden
application/json

404
Not found
application/json

500
Internal server error
application/json
Request Example forget/api/v2/orders/{trackingId}/relatives
Shell Curl
curl 'https://api.mdm.express/api/v2/orders/{trackingId}/relatives' \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN'

Ask AI Agent

Test Request
(get /api/v2/orders/{trackingId}/relatives)
Status:200
Status:400
Status:401
Status:403
Status:404
Status:500
{
  "list": [
    {
      "type": "line-item",
      "data": null
    }
  ]
}

Success

Get Order Status History​Copy link
Path Parameters
trackingIdCopy link to trackingId
Type:string
required
Responses

200
Success
application/json

400
Validation failed
application/json

401
Invalid Token
application/json

403
Forbidden
application/json

404
Not found
application/json

500
Internal server error
application/json
Request Example forget/api/v2/orders/{trackingId}/status-history
Shell Curl
curl 'https://api.mdm.express/api/v2/orders/{trackingId}/status-history' \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN'

Ask AI Agent

Test Request
(get /api/v2/orders/{trackingId}/status-history)
Status:200
Status:400
Status:401
Status:403
Status:404
Status:500
{
  "list": [
    {
      "date": "2026-04-26T12:03:52.054Z",
      "notes": null,
      "status": "string",
      "responsible": {
        "trackingId": "string",
        "firstName": "string",
        "lastName": "string",
        "phones": [
          "string"
        ],
        "pictureId": null
      },
      "meta": null
    }
  ]
}

Success

Get Orders​Copy link
Body
·GetOrdersRequest
required
application/json
fieldsCopy link to fields
Type:array string[]
enum
values
trackingId
externalId
ip
utmSource
currency
Show all values
filtersCopy link to filters
Type:object · GetOrdersRequestFilters
Show Child Attributesfor filters
paginationCopy link to pagination
Type:object · SearchRequestPagination
Show Child Attributesfor pagination
sortByCopy link to sortBy
Type:object · GetOrdersRequestSort
Show Child Attributesfor sortBy
Responses

200
Success
application/json

400
Validation failed
application/json

401
Invalid Token
application/json

403
Forbidden
application/json

404
Not found
application/json

500
Internal server error
application/json
Request Example forpost/api/v2/orders/search
Shell Curl
curl https://api.mdm.express/api/v2/orders/search \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
  --data '{
  "filters": {
    "trackingId": [
      ""
    ],
    "externalId": [
      ""
    ],
    "shippingCompany": [
      ""
    ],
    "utmSource": [
      ""
    ],
    "ip": [
      ""
    ],
    "paymentStatus": [
      ""
    ],
    "paymentMethod": [
      ""
    ],
    "createdBy": [
      ""
    ],
    "stopDeskId": [
      ""
    ],
    "search": "",
    "countryId": [
      ""
    ],
    "source": [
      ""
    ],
    "sellerId": [
      ""
    ],
    "storeType": [
      ""
    ],
    "isDropshipping": true,
    "startingStateId": [
      ""
    ],
    "destinationStateId": [
      ""
    ],
    "storeId": [
      ""
    ],
    "status": [
      ""
    ],
    "archived": true,
    "isStopDesk": true,
    "upsell": true,
    "junk": true,
    "freeShipping": true,
    "confirmed": true,
    "isFulfilledByUs": true,
    "followedUp": true,
    "productId": [
      ""
    ],
    "createdAt": {
      "start": "",
      "end": ""
    },
    "updatedAt": {
      "start": "",
      "end": ""
    },
    "statusDate": {
      "start": "",
      "end": ""
    }
  },
  "sortBy": {
    "createdAt": "ASC",
    "updatedAt": "ASC"
  },
  "fields": [
    "trackingId"
  ],
  "pagination": {
    "page": 1,
    "perPage": 1
  }
}'

Ask AI Agent

Test Request
(post /api/v2/orders/search)
Status:200
Status:400
Status:401
Status:403
Status:404
Status:500
{
  "pagination": {
    "page": 1,
    "perPage": 1,
    "total": 1,
    "totalPages": 1,
    "hasMore": true,
    "firstPage": 1,
    "lastPage": 1,
    "nextPage": null,
    "prevPage": null
  },
  "list": [
    {
      "trackingId": "string",
      "externalId": null,
      "ip": null,
      "utmSource": null,
      "currency": "string",
      "isDropShipping": true,
      "client": {
        "firstName": "string",
        "lastName": "string",
        "phone": "string",
        "phone2": null
      },
      "source": "string",
      "totalPrice": 1,
      "destination": {
        "cityId": "string",
        "cityCode": "string",
        "cityName": "string",
        "stateId": "string",
        "stateCode": "string",
        "stateName": "string",
        "countryId": "string",
        "countryCode": "string",
        "countryName": "string",
        "streetAddress": "string",
        "gps": "string"
      },
      "confirmed": true,
      "confirmedByUs": true,
      "freeShipping": true,
      "isInsuranceEnabled": true,
      "declaredValue": null,
      "isStopDesk": true,
      "stopDeskId": null,
      "paymentMethod": null,
      "openable": true,
      "liquid": true,
      "fragile": true,
      "length": 1,
      "height": 1,
      "weight": 1,
      "width": 1,
      "archived": true,
      "createdAt": "2026-04-26T12:03:52.054Z",
      "createdBy": "string",
      "updatedAt": "2026-04-26T12:03:52.054Z",
      "updatedBy": "string",
      "status": "string",
      "statusDate": "2026-04-26T12:03:52.054Z",
      "country": {
        "id": "string",
        "name": "string",
        "nameAr": "string",
        "code": "string",
        "flag": "string"
      },
      "seller": {
        "trackingId": "string",
        "firstName": "string",
        "lastName": "string"
      },
      "store": {
        "trackingId": "string",
        "name": "string",
        "logoId": null
      },
      "products": [
        {
          "trackingId": "string",
          "name": "string",
          "quantity": 1,
          "variantOf": "string",
          "description": "string",
          "images": [
            "string"
          ],
          "price": null
        }
      ],
      "relatives": [
        {
          "type": "line-item",
          "data": null
        }
      ]
    }
  ]
}

Success

Create Order​Copy link
Body
·CreateOrderRequest
required
application/json
clientCopy link to client
Type:object · CreateOrderRequestProductClient
required
Show Child Attributesfor client
notesCopy link to notes
Type:string
required
productsCopy link to products
Type:array object[] · CreateOrderRequestProduct[]
required
Show Child Attributesfor products
storeIdCopy link to storeId
Type:string
required
totalPriceCopy link to totalPrice
Type:number
required
confirmedCopy link to confirmed
Type:boolean
confirmedByUsCopy link to confirmedByUs
Type:boolean
declaredValueCopy link to declaredValue
Type:number
destinationCopy link to destination
Type:object · AddressToCreate
Show Child Attributesfor destination
fragileCopy link to fragile
Type:boolean
freeShippingCopy link to freeShipping
Type:boolean
heightCopy link to height
Type:number
Show additional propertiesfor Request Body
Responses

200
Success
application/json

400
Validation failed
application/json

401
Invalid Token
application/json

403
Forbidden
application/json

404
Not found
application/json

500
Internal server error
application/json
Request Example forpost/api/v2/orders
Shell Curl
curl https://api.mdm.express/api/v2/orders \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
  --data '{
  "products": [
    {
      "trackingId": "",
      "quantity": 1,
      "price": 1,
      "displayName": ""
    }
  ],
  "totalPrice": 1,
  "storeId": "",
  "notes": "",
  "client": {
    "firstName": "",
    "lastName": "",
    "phone": "",
    "phone2": ""
  },
  "destination": {
    "cityId": "",
    "streetAddress": "",
    "gps": {
      "latitude": 1,
      "longitude": 1,
      "link": ""
    }
  },
  "freeShipping": true,
  "stopDeskId": "",
  "isStopDesk": true,
  "isInsuranceEnabled": true,
  "declaredValue": 1,
  "paymentMethod": "",
  "offerId": "",
  "height": 1,
  "width": 1,
  "length": 1,
  "weight": 1,
  "fragile": true,
  "openable": true,
  "liquid": true,
  "confirmed": true,
  "confirmedByUs": true
}'

Ask AI Agent

Test Request
(post /api/v2/orders)
Status:200
Status:400
Status:401
Status:403
Status:404
Status:500
{
  "trackingId": "string"
}

Success

Create Orders​Copy link
Body
·CreateOrdersRequest
required
application/json
ordersCopy link to orders
Type:array object[] · CreateOrdersRequestLead[]
required
Show Child Attributesfor orders
storeIdCopy link to storeId
Type:string
required
confirmedCopy link to confirmed
Type:boolean
confirmedByUsCopy link to confirmedByUs
Type:boolean
Responses

200
Success
application/json

400
Validation failed
application/json

401
Invalid Token
application/json

403
Forbidden
application/json

404
Not found
application/json

500
Internal server error
application/json
Request Example forpost/api/v2/orders/bulk
Shell Curl
curl https://api.mdm.express/api/v2/orders/bulk \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN' \
  --data '{
  "storeId": "",
  "confirmed": true,
  "confirmedByUs": true,
  "orders": [
    {
      "clientName": "",
      "clientPhone": "",
      "state": "",
      "city": "",
      "address": "",
      "productId": [
        ""
      ],
      "quantity": [
        1
      ],
      "totalPrice": 1,
      "freeShipping": true,
      "isStopDesk": true,
      "stopDeskId": "",
      "isInsuranceEnabled": true,
      "declaredValue": 1,
      "paymentMethod": "",
      "height": 1,
      "width": 1,
      "length": 1,
      "weight": 1,
      "fragile": true,
      "openable": true,
      "liquid": true
    }
  ]
}'

Ask AI Agent

Test Request
(post /api/v2/orders/bulk)
Status:200
Status:400
Status:401
Status:403
Status:404
Status:500
{
  "results": [
    {
      "index": 1,
      "success": true,
      "error": {
        "code": "string",
        "message": "string",
        "payload": {}
      }
    }
  ]
}

Success

Get Orders Statuses Statistics​Copy link
Query Parameters
trackingIdCopy link to trackingId
Type:array string[]
externalIdCopy link to externalId
Type:array string[]
shippingCompanyCopy link to shippingCompany
Type:array string[]
utmSourceCopy link to utmSource
Type:array string[]
ipCopy link to ip
Type:array string[]
paymentStatusCopy link to paymentStatus
Type:array string[]
paymentMethodCopy link to paymentMethod
Type:array string[]
createdByCopy link to createdBy
Type:array string[]
stopDeskIdCopy link to stopDeskId
Type:array string[]
searchCopy link to search
Type:string
countryIdCopy link to countryId
Type:array string[]
sourceCopy link to source
Type:array string[]
sellerIdCopy link to sellerId
Type:array string[]
storeTypeCopy link to storeType
Type:array string[]
isDropshippingCopy link to isDropshipping
Type:boolean
startingStateIdCopy link to startingStateId
Type:array string[]
destinationStateIdCopy link to destinationStateId
Type:array string[]
storeIdCopy link to storeId
Type:array string[]
archivedCopy link to archived
Type:boolean
isStopDeskCopy link to isStopDesk
Type:boolean
upsellCopy link to upsell
Type:boolean
junkCopy link to junk
Type:boolean
freeShippingCopy link to freeShipping
Type:boolean
confirmedCopy link to confirmed
Type:boolean
isFulfilledByUsCopy link to isFulfilledByUs
Type:boolean
followedUpCopy link to followedUp
Type:boolean
productIdCopy link to productId
Type:array string[]
createdAtCopy link to createdAt
Type:object · DateRangeDto
endCopy link to end
Type:string
Format:date-time
the date-time notation as defined by RFC 3339, section 5.6, for example, 2017-07-21T17:32:28Z

startCopy link to start
Type:string
Format:date-time
the date-time notation as defined by RFC 3339, section 5.6, for example, 2017-07-21T17:32:28Z

updatedAtCopy link to updatedAt
Type:object · DateRangeDto
endCopy link to end
Type:string
Format:date-time
the date-time notation as defined by RFC 3339, section 5.6, for example, 2017-07-21T17:32:28Z

startCopy link to start
Type:string
Format:date-time
the date-time notation as defined by RFC 3339, section 5.6, for example, 2017-07-21T17:32:28Z

statusDateCopy link to statusDate
Type:object · DateRangeDto
endCopy link to end
Type:string
Format:date-time
the date-time notation as defined by RFC 3339, section 5.6, for example, 2017-07-21T17:32:28Z

startCopy link to start
Type:string
Format:date-time
the date-time notation as defined by RFC 3339, section 5.6, for example, 2017-07-21T17:32:28Z

Responses

200
Success
application/json

400
Validation failed
application/json

401
Invalid Token
application/json

403
Forbidden
application/json

404
Not found
application/json

500
Internal server error
application/json
Request Example forget/api/v2/orders/statistics/statuses
Shell Curl
curl 'https://api.mdm.express/api/v2/orders/statistics/statuses?trackingId=&externalId=&shippingCompany=&utmSource=&ip=&paymentStatus=&paymentMethod=&createdBy=&stopDeskId=&search=&countryId=&source=&sellerId=&storeType=&isDropshipping=true&startingStateId=&destinationStateId=&storeId=&archived=true&isStopDesk=true&upsell=true&junk=true&freeShipping=true&confirmed=true&isFulfilledByUs=true&followedUp=true&productId=&start=&end=&start=&end=&start=&end=' \
  --header 'Authorization: Bearer YOUR_SECRET_TOKEN'

Ask AI Agent

Test Request
(get /api/v2/orders/statistics/statuses)
Status:200
Status:400
Status:401
Status:403
Status:404
Status:500
{
  "pagination": {
    "page": 1,
    "perPage": 1,
    "total": 1,
    "totalPages": 1,
    "hasMore": true,
    "firstPage": 1,
    "lastPage": 1,
    "nextPage": null,
    "prevPage": null
  },
  "list": [
    {
      "status": "string",
      "total": 1
    }
  ]
}

JSONCopy
JSONCopy
Successimport { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { ShoppingCart, Truck, Shield, Zap, Bell, MessageSquare, ChevronDown, ChevronUp, Check, Save } from 'lucide-react';

function getCsrfToken() {
  return document.cookie.split('; ').find(r => r.startsWith('ecopro_csrf='))?.split('=')[1] || '';
}

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}

const SECTIONS: Section[] = [
  { id: 'order_fields',   icon: <ShoppingCart className="h-5 w-5" />, title: 'حقول الطلب',         subtitle: 'تحكم في البيانات المطلوبة من العميل' },
  { id: 'payment',        icon: <Shield className="h-5 w-5" />,       title: 'طريقة الدفع',        subtitle: 'إعدادات الدفع والضمان' },
  { id: 'delivery',       icon: <Truck className="h-5 w-5" />,        title: 'التوصيل',            subtitle: 'قواعد التوصيل والشحن المجاني' },
  { id: 'limits',         icon: <ShoppingCart className="h-5 w-5" />, title: 'حدود الطلب',         subtitle: 'الحد الأدنى والأقصى للطلبات' },
  { id: 'post_order',     icon: <MessageSquare className="h-5 w-5" />,title: 'ما بعد الطلب',       subtitle: 'رسالة الشكر وإعادة التوجيه' },
  { id: 'trust',          icon: <Shield className="h-5 w-5" />,       title: 'الثقة والضمان',      subtitle: 'شارات الثقة في صفحة الطلب' },
  { id: 'urgency',        icon: <Zap className="h-5 w-5" />,          title: 'العروض والإلحاح',    subtitle: 'العد التنازلي وعداد المخزون' },
  { id: 'notifications',  icon: <Bell className="h-5 w-5" />,         title: 'الإشعارات',          subtitle: 'إشعارات الطلبات الجديدة' },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function SectionCard({ section, open, onToggle, children }: { section: Section; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-right hover:bg-muted/30 transition-colors"
      >
        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {section.icon}
        </div>
        <div className="flex-1 min-w-0 text-right">
          <div className="font-bold text-sm">{section.title}</div>
          <div className="text-xs text-muted-foreground">{section.subtitle}</div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border/40 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
    />
  );
}

function Textarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
    />
  );
}

export default function CheckoutSettings() {
  const navigate = useNavigate();
  const { storeSettings: settings } = useStoreSettings({ enabled: true, onUnauthorized: () => navigate('/login') });

  const [openSection, setOpenSection] = useState<string | null>('order_fields');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    // Order fields
    order_field_address: false,
    order_field_commune: false,
    order_field_notes: false,
    order_field_quantity: true,
    order_field_custom_label: '',

    // Payment
    payment_cod: true,
    payment_online: false,
    payment_guarantee_text: '',
    show_cod_badge: true,

    // Delivery
    free_delivery_threshold: '',
    default_delivery_type: 'desk',
    show_delivery_price: true,
    hide_delivery_if_free: false,

    // Limits
    min_order_quantity: '1',
    max_order_quantity: '',
    out_of_stock_behavior: 'hide',

    // Post order
    thank_you_message: '',
    redirect_url: '',
    show_telegram_connect: true,
    show_whatsapp_followup: false,
    whatsapp_followup_number: '',

    // Trust
    show_trust_badges: true,
    trust_badge_delivery: true,
    trust_badge_cod: true,
    trust_badge_guarantee: true,
    custom_guarantee_text: '',
    show_reviews_count: false,

    // Urgency
    show_countdown: false,
    countdown_minutes: '15',
    show_stock_counter: false,
    stock_counter_threshold: '10',
    urgency_message: '',

    // Notifications
    notify_telegram: true,
    notify_whatsapp: false,
    notify_email: false,
    auto_reply_customer: false,
    auto_reply_message: '',
  });

  // Sync from settings
  useEffect(() => {
    if (!settings) return;
    const s = settings as any;
    setForm(prev => ({
      ...prev,
      order_field_address:      s.order_field_address      ?? false,
      order_field_commune:      s.order_field_commune      ?? false,
      order_field_notes:        s.order_field_notes        ?? false,
      order_field_quantity:     s.order_field_quantity     ?? true,
      order_field_custom_label: s.order_field_custom_label ?? '',
      payment_cod:              s.payment_cod              ?? true,
      payment_online:           s.payment_online           ?? false,
      payment_guarantee_text:   s.payment_guarantee_text   ?? '',
      show_cod_badge:           s.show_cod_badge           ?? true,
      free_delivery_threshold:  String(s.free_delivery_threshold ?? ''),
      default_delivery_type:    s.default_delivery_type    ?? 'desk',
      show_delivery_price:      s.show_delivery_price      ?? true,
      hide_delivery_if_free:    s.hide_delivery_if_free    ?? false,
      min_order_quantity:       String(s.min_order_quantity ?? '1'),
      max_order_quantity:       String(s.max_order_quantity ?? ''),
      out_of_stock_behavior:    s.out_of_stock_behavior    ?? 'hide',
      thank_you_message:        s.thank_you_message        ?? '',
      redirect_url:             s.redirect_url             ?? '',
      show_telegram_connect:    s.show_telegram_connect    ?? true,
      show_whatsapp_followup:   s.show_whatsapp_followup   ?? false,
      whatsapp_followup_number: s.whatsapp_followup_number ?? '',
      show_trust_badges:        s.show_trust_badges        ?? true,
      trust_badge_delivery:     s.trust_badge_delivery     ?? true,
      trust_badge_cod:          s.trust_badge_cod          ?? true,
      trust_badge_guarantee:    s.trust_badge_guarantee    ?? true,
      custom_guarantee_text:    s.custom_guarantee_text    ?? '',
      show_reviews_count:       s.show_reviews_count       ?? false,
      show_countdown:           s.show_countdown           ?? false,
      countdown_minutes:        String(s.countdown_minutes ?? '15'),
      show_stock_counter:       s.show_stock_counter       ?? false,
      stock_counter_threshold:  String(s.stock_counter_threshold ?? '10'),
      urgency_message:          s.urgency_message          ?? '',
      notify_telegram:          s.notify_telegram          ?? true,
      notify_whatsapp:          s.notify_whatsapp          ?? false,
      notify_email:             s.notify_email             ?? false,
      auto_reply_customer:      s.auto_reply_customer      ?? false,
      auto_reply_message:       s.auto_reply_message       ?? '',
    }));
  }, [settings]);

  const set = (key: keyof typeof form, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/client/store/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: string) => setOpenSection(prev => prev === id ? null : id);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-3" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black">إعدادات الشراء</h1>
          <p className="text-sm text-muted-foreground mt-0.5">تحكم في تجربة الشراء لمتجرك</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold bg-primary text-white shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? 'تم الحفظ' : saving ? 'جاري...' : 'حفظ'}
        </button>
      </div>

      {/* Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <SectionCard section={SECTIONS[0]} open={openSection === 'order_fields'} onToggle={() => toggle('order_fields')}>
        <Row label="الكمية" hint="السماح للعميل باختيار الكمية">
          <Toggle checked={form.order_field_quantity} onChange={v => set('order_field_quantity', v)} />
        </Row>
        <Row label="العنوان التفصيلي" hint="حقل إضافي للعنوان">
          <Toggle checked={form.order_field_address} onChange={v => set('order_field_address', v)} />
        </Row>
        <Row label="البلدية" hint="حقل اختيار البلدية">
          <Toggle checked={form.order_field_commune} onChange={v => set('order_field_commune', v)} />
        </Row>
        <Row label="ملاحظات" hint="حقل ملاحظات إضافية">
          <Toggle checked={form.order_field_notes} onChange={v => set('order_field_notes', v)} />
        </Row>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">حقل مخصص (اختياري)</label>
          <Input value={form.order_field_custom_label} onChange={v => set('order_field_custom_label', v)} placeholder="مثال: رقم الشقة، وقت التسليم المفضل..." />
        </div>
      </SectionCard>

      {/* 2. Payment */}
      <SectionCard section={SECTIONS[1]} open={openSection === 'payment'} onToggle={() => toggle('payment')}>
        <Row label="الدفع عند الاستلام" hint="COD - الطريقة الافتراضية">
          <Toggle checked={form.payment_cod} onChange={v => set('payment_cod', v)} />
        </Row>
        <Row label="الدفع الإلكتروني" hint="تفعيل الدفع أونلاين">
          <Toggle checked={form.payment_online} onChange={v => set('payment_online', v)} />
        </Row>
        <Row label="شارة الدفع عند الاستلام" hint="إظهار شارة COD في الفورم">
          <Toggle checked={form.show_cod_badge} onChange={v => set('show_cod_badge', v)} />
        </Row>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">نص الضمان المخصص</label>
          <Input value={form.payment_guarantee_text} onChange={v => set('payment_guarantee_text', v)} placeholder="مثال: الدفع عند الاستلام بعد معاينة المنتج" />
        </div>
      </SectionCard>

      {/* 3. Delivery */}
      <SectionCard section={SECTIONS[2]} open={openSection === 'delivery'} onToggle={() => toggle('delivery')}>
        <Row label="إظهار سعر التوصيل" hint="عرض تكلفة التوصيل للعميل">
          <Toggle checked={form.show_delivery_price} onChange={v => set('show_delivery_price', v)} />
        </Row>
        <Row label="إخفاء التوصيل إذا كان مجانياً">
          <Toggle checked={form.hide_delivery_if_free} onChange={v => set('hide_delivery_if_free', v)} />
        </Row>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">حد التوصيل المجاني (DZD)</label>
          <Input value={form.free_delivery_threshold} onChange={v => set('free_delivery_threshold', v)} placeholder="مثال: 5000 — مجاني إذا تجاوز الطلب هذا المبلغ" type="number" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">نوع التوصيل الافتراضي</label>
          <div className="flex gap-2">
            {[{ v: 'desk', l: 'مكتب' }, { v: 'home', l: 'منزل' }].map(opt => (
              <button key={opt.v} type="button" onClick={() => set('default_delivery_type', opt.v)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${form.default_delivery_type === opt.v ? 'bg-primary text-white border-primary' : 'bg-background border-border hover:bg-muted'}`}>
                {opt.l}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* 4. Limits */}
      <SectionCard section={SECTIONS[3]} open={openSection === 'limits'} onToggle={() => toggle('limits')}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">الحد الأدنى للكمية</label>
            <Input value={form.min_order_quantity} onChange={v => set('min_order_quantity', v)} placeholder="1" type="number" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">الحد الأقصى للكمية</label>
            <Input value={form.max_order_quantity} onChange={v => set('max_order_quantity', v)} placeholder="بلا حد" type="number" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">عند نفاذ المخزون</label>
          <div className="flex gap-2">
            {[{ v: 'hide', l: 'إخفاء المنتج' }, { v: 'show', l: 'إظهار "غير متوفر"' }].map(opt => (
              <button key={opt.v} type="button" onClick={() => set('out_of_stock_behavior', opt.v)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors ${form.out_of_stock_behavior === opt.v ? 'bg-primary text-white border-primary' : 'bg-background border-border hover:bg-muted'}`}>
                {opt.l}
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* 5. Post Order */}
      <SectionCard section={SECTIONS[4]} open={openSection === 'post_order'} onToggle={() => toggle('post_order')}>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">رسالة الشكر</label>
          <Textarea value={form.thank_you_message} onChange={v => set('thank_you_message', v)} placeholder="شكراً لطلبك! سنتواصل معك قريباً لتأكيد الطلب." />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">رابط إعادة التوجيه بعد الطلب</label>
          <Input value={form.redirect_url} onChange={v => set('redirect_url', v)} placeholder="https://..." />
        </div>
        <Row label="زر ربط تيليغرام" hint="إظهار زر متابعة عبر تيليغرام">
          <Toggle checked={form.show_telegram_connect} onChange={v => set('show_telegram_connect', v)} />
        </Row>
        <Row label="متابعة واتساب" hint="إرسال رسالة متابعة للعميل">
          <Toggle checked={form.show_whatsapp_followup} onChange={v => set('show_whatsapp_followup', v)} />
        </Row>
        {form.show_whatsapp_followup && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">رقم واتساب</label>
            <Input value={form.whatsapp_followup_number} onChange={v => set('whatsapp_followup_number', v)} placeholder="+213..." />
          </div>
        )}
      </SectionCard>

      {/* 6. Trust */}
      <SectionCard section={SECTIONS[5]} open={openSection === 'trust'} onToggle={() => toggle('trust')}>
        <Row label="إظهار شارات الثقة" hint="عرض شارات الضمان والتوصيل">
          <Toggle checked={form.show_trust_badges} onChange={v => set('show_trust_badges', v)} />
        </Row>
        {form.show_trust_badges && (
          <>
            <Row label="🚚 توصيل سريع"><Toggle checked={form.trust_badge_delivery} onChange={v => set('trust_badge_delivery', v)} /></Row>
            <Row label="💳 الدفع عند الاستلام"><Toggle checked={form.trust_badge_cod} onChange={v => set('trust_badge_cod', v)} /></Row>
            <Row label="🛡️ ضمان الجودة"><Toggle checked={form.trust_badge_guarantee} onChange={v => set('trust_badge_guarantee', v)} /></Row>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">نص الضمان المخصص</label>
              <Input value={form.custom_guarantee_text} onChange={v => set('custom_guarantee_text', v)} placeholder="ضمان استرجاع خلال 7 أيام" />
            </div>
          </>
        )}
        <Row label="عداد التقييمات" hint="إظهار عدد المراجعات">
          <Toggle checked={form.show_reviews_count} onChange={v => set('show_reviews_count', v)} />
        </Row>
      </SectionCard>

      {/* 7. Urgency */}
      <SectionCard section={SECTIONS[6]} open={openSection === 'urgency'} onToggle={() => toggle('urgency')}>
        <Row label="عداد تنازلي" hint="يخلق إلحاحية لدى العميل">
          <Toggle checked={form.show_countdown} onChange={v => set('show_countdown', v)} />
        </Row>
        {form.show_countdown && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">مدة العد التنازلي (دقيقة)</label>
            <Input value={form.countdown_minutes} onChange={v => set('countdown_minutes', v)} placeholder="15" type="number" />
          </div>
        )}
        <Row label="عداد المخزون" hint='مثال: "تبقى 3 قطع فقط"'>
          <Toggle checked={form.show_stock_counter} onChange={v => set('show_stock_counter', v)} />
        </Row>
        {form.show_stock_counter && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">إظهار العداد عند الكمية أقل من</label>
            <Input value={form.stock_counter_threshold} onChange={v => set('stock_counter_threshold', v)} placeholder="10" type="number" />
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">رسالة الإلحاح</label>
          <Input value={form.urgency_message} onChange={v => set('urgency_message', v)} placeholder='مثال: "🔥 عرض محدود — اطلب الآن!"' />
        </div>
      </SectionCard>

      {/* 8. Notifications */}
      <SectionCard section={SECTIONS[7]} open={openSection === 'notifications'} onToggle={() => toggle('notifications')}>
        <Row label="إشعار تيليغرام" hint="إشعار فوري عند كل طلب جديد">
          <Toggle checked={form.notify_telegram} onChange={v => set('notify_telegram', v)} />
        </Row>
        <Row label="إشعار واتساب">
          <Toggle checked={form.notify_whatsapp} onChange={v => set('notify_whatsapp', v)} />
        </Row>
        <Row label="إشعار بريد إلكتروني">
          <Toggle checked={form.notify_email} onChange={v => set('notify_email', v)} />
        </Row>
        <Row label="رد تلقائي للعميل" hint="رسالة تلقائية بعد تأكيد الطلب">
          <Toggle checked={form.auto_reply_customer} onChange={v => set('auto_reply_customer', v)} />
        </Row>
        {form.auto_reply_customer && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">نص الرد التلقائي</label>
            <Textarea value={form.auto_reply_message} onChange={v => set('auto_reply_message', v)} placeholder="شكراً لطلبك رقم {order_id}، سنتواصل معك خلال 24 ساعة." />
          </div>
        )}
      </SectionCard>

      </div>

      {/* Bottom save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3.5 rounded-2xl text-base font-black bg-primary text-white shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saved ? <Check className="h-5 w-5" /> : <Save className="h-5 w-5" />}
        {saved ? 'تم الحفظ بنجاح ✓' : saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
      </button>
    </div>
  );
}
