# ECOTRACK API Documentation

L'API Public ECOTRACK vous permet d'utiliser le service sans passer par l'interface web et vous donne la possibilité de lier votre compte avec votre CRM, Plateforme E-commerce ou autres applications.

## Fonctionnalités disponibles

- L'ajout de commande
- La modification de commande
- L'ajout et la récupération des mises à jours sur l'état de livraison
- Demander le retour d'un colis
- Suivre l'avancement de livraison d'un colis

---

## Base URL

```
{{url}}
```

Authentication uses **Bearer Token** unless noted as public.

---

## GET /api/v1/get/fees — Tarifs des prestations

Récupérer les tarifs appliqués pour votre compte. Seuls les wilayas actives seront retournées.

Tarifs séparés pour :
- Livraison (à domicile, stop desk)
- Pickup (à domicile, stop desk)
- Échange (à domicile, stop desk)
- Recouvrement (à domicile, stop desk)
- Retour (à domicile, stop desk)

**Auth:** Public (no token required)

**Example Request:**
```bash
curl --location '{{url}}/api/v1/get/fees'
```

**Example Response:**
```json
{
  "livraison": [
    { "wilaya_id": 1, "tarif": "1300", "tarif_stopdesk": "900" },
    { "wilaya_id": 2, "tarif": "850", "tarif_stopdesk": "450" },
    { "wilaya_id": 3, "tarif": "950", "tarif_stopdesk": "550" },
    { "wilaya_id": 4, "tarif": "850", "tarif_stopdesk": "450" },
    { "wilaya_id": 5, "tarif": "900", "tarif_stopdesk": "500" },
    { "wilaya_id": 6, "tarif": "800", "tarif_stopdesk": "450" },
    { "wilaya_id": 7, "tarif": "950", "tarif_stopdesk": "550" },
    { "wilaya_id": 8, "tarif": "1000", "tarif_stopdesk": "650" },
    { "wilaya_id": 9, "tarif": "650", "tarif_stopdesk": "400" },
    { "wilaya_id": 10, "tarif": "700", "tarif_stopdesk": "550" },
    { "wilaya_id": 11, "tarif": "1500", "tarif_stopdesk": "1100" },
    { "wilaya_id": 12, "tarif": "900", "tarif_stopdesk": "0" },
    { "wilaya_id": 13, "tarif": "900", "tarif_stopdesk": "500" },
    { "wilaya_id": 14, "tarif": "850", "tarif_stopdesk": "0" },
    { "wilaya_id": 15, "tarif": "750", "tarif_stopdesk": "450" },
    { "wilaya_id": 16, "tarif": "450", "tarif_stopdesk": "300" },
    { "wilaya_id": 17, "tarif": "950", "tarif_stopdesk": "500" },
    { "wilaya_id": 18, "tarif": "900", "tarif_stopdesk": "0" },
    { "wilaya_id": 19, "tarif": "800", "tarif_stopdesk": "450" },
    { "wilaya_id": 20, "tarif": "900", "tarif_stopdesk": "0" },
    { "wilaya_id": 21, "tarif": "900", "tarif_stopdesk": "450" },
    { "wilaya_id": 22, "tarif": "900", "tarif_stopdesk": "0" },
    { "wilaya_id": 23, "tarif": "850", "tarif_stopdesk": "450" },
    { "wilaya_id": 24, "tarif": "900", "tarif_stopdesk": "450" },
    { "wilaya_id": 25, "tarif": "800", "tarif_stopdesk": "450" },
    { "wilaya_id": 26, "tarif": "800", "tarif_stopdesk": "0" },
    { "wilaya_id": 27, "tarif": "900", "tarif_stopdesk": "450" },
    { "wilaya_id": 28, "tarif": "850", "tarif_stopdesk": "500" },
    { "wilaya_id": 29, "tarif": "900", "tarif_stopdesk": "0" },
    { "wilaya_id": 30, "tarif": "950", "tarif_stopdesk": "600" },
    { "wilaya_id": 31, "tarif": "800", "tarif_stopdesk": "450" },
    { "wilaya_id": 32, "tarif": "1000", "tarif_stopdesk": "0" },
    { "wilaya_id": 34, "tarif": "800", "tarif_stopdesk": "450" },
    { "wilaya_id": 35, "tarif": "650", "tarif_stopdesk": "0" },
    { "wilaya_id": 36, "tarif": "850", "tarif_stopdesk": "0" },
    { "wilaya_id": 38, "tarif": "900", "tarif_stopdesk": "0" },
    { "wilaya_id": 39, "tarif": "950", "tarif_stopdesk": "600" },
    { "wilaya_id": 40, "tarif": "900", "tarif_stopdesk": "0" },
    { "wilaya_id": 41, "tarif": "900", "tarif_stopdesk": "450" },
    { "wilaya_id": 42, "tarif": "650", "tarif_stopdesk": "450" },
    { "wilaya_id": 43, "tarif": "900", "tarif_stopdesk": "450" },
    { "wilaya_id": 44, "tarif": "900", "tarif_stopdesk": "0" },
    { "wilaya_id": 45, "tarif": "1000", "tarif_stopdesk": "0" },
    { "wilaya_id": 46, "tarif": "900", "tarif_stopdesk": "0" },
    { "wilaya_id": 47, "tarif": "950", "tarif_stopdesk": "450" },
    { "wilaya_id": 48, "tarif": "900", "tarif_stopdesk": "450" },
    { "wilaya_id": 49, "tarif": "1300", "tarif_stopdesk": "0" },
    { "wilaya_id": 51, "tarif": "950", "tarif_stopdesk": "0" },
    { "wilaya_id": 52, "tarif": "1000", "tarif_stopdesk": "0" },
    { "wilaya_id": 53, "tarif": "1500", "tarif_stopdesk": "0" },
    { "wilaya_id": 54, "tarif": "1500", "tarif_stopdesk": "0" },
    { "wilaya_id": 55, "tarif": "950", "tarif_stopdesk": "0" },
    { "wilaya_id": 57, "tarif": "950", "tarif_stopdesk": "0" },
    { "wilaya_id": 58, "tarif": "1000", "tarif_stopdesk": "0" }
  ],
  "pickup": [ "/* same structure as livraison */" ],
  "echnage": [ "/* same structure as livraison — note: typo in API, should be 'echange' */" ],
  "recouvrement": [ "/* same structure as livraison */" ],
  "retours": [
    { "wilaya_id": 1, "tarif": "200", "tarif_stopdesk": "200" },
    { "wilaya_id": 2, "tarif": "150", "tarif_stopdesk": "150" },
    { "wilaya_id": 9, "tarif": "100", "tarif_stopdesk": "100" },
    { "wilaya_id": 11, "tarif": "250", "tarif_stopdesk": "250" },
    { "wilaya_id": 16, "tarif": "0", "tarif_stopdesk": "0" },
    { "wilaya_id": 49, "tarif": "200", "tarif_stopdesk": "200" },
    { "wilaya_id": 53, "tarif": "250", "tarif_stopdesk": "250" },
    { "wilaya_id": 54, "tarif": "250", "tarif_stopdesk": "250" }
    // all others: 150/150
  ]
}
```

> **Note:** `tarif_stopdesk: "0"` means stop desk is not available for that wilaya.

---

## GET /api/v1/get/products/list — Liste des produits

**Auth:** Bearer Token required

**Example Request:**
```bash
curl --location '{{url}}/api/v1/get/products/list' \
  --header 'Authorization: Bearer <token>'
```

**Example Response:**
```json
{
  "products": [
    {
      "reference": "290444",
      "barcode": null,
      "title": "kas",
      "is_active": 1,
      "image": null,
      "stock_disponible": 1,
      "stock_reserve": 1,
      "stock_phisique": 2
    }
  ]
}
```

---

## POST /api/v1/create/order — Ajouter une commande

**Auth:** Bearer Token required

This is the endpoint used to create/upload a shipment order to Ecotrack.

**Example Request:**
```bash
curl --location --request POST '{{url}}/api/v1/create/order?reference=ORD-001&nom_client=John&telephone=0550000000&adresse=Rue+Example&commune=Alger+Centre&code_wilaya=16&montant=2500&produit=Produit&type=livraison&stop_desk=0&fragile=0' \
  --header 'Authorization: Bearer <token>'
```

**Key Query Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| `reference` | optional | Your internal order reference |
| `nom_client` | required | Customer full name |
| `telephone` | required | Primary phone |
| `telephone_2` | optional | Secondary phone |
| `adresse` | required | Delivery address |
| `commune` | required | Commune name |
| `code_wilaya` | required | Wilaya number (1–58) |
| `montant` | required | COD amount (DA) |
| `produit` | optional | Product description |
| `remarque` | optional | Order notes |
| `type` | required | `livraison`, `pickup`, `echange`, `recouvrement` |
| `stop_desk` | required | `0` = home delivery, `1` = stop desk |
| `fragile` | optional | `0` or `1` |
| `weight` | optional | Package weight |
| `gps_link` | optional | GPS coordinates link |

---

## GET /api/v1/get/order/{tracking} — Suivi de commande

**Auth:** Bearer Token required

```bash
curl --location '{{url}}/api/v1/get/order/{tracking_number}' \
  --header 'Authorization: Bearer <token>'
```

---

## POST /api/v1/update/order — Modifier une commande

**Auth:** Bearer Token required

---

## POST /api/v1/return/order — Demander un retour

**Auth:** Bearer Token required

---

## Notes d'intégration

- The existing `server/services/couriers/ecotrack.ts` needs to implement `createShipment()` using `POST /api/v1/create/order`
- The error `The route api/v1/add/order could not be found` was caused by wrong endpoint — correct one is `/api/v1/create/order`
- Ensure `ECOTRACK_API_URL` is set in `.env` (e.g. `https://app.ecotrack.dz`)
