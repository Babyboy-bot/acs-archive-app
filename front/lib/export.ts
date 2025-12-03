import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export interface Document {
  id: string | number
  titre: string
  client: string
  risque: string
  typeCourrier: string
  date: string
  taille: string
  reference: string
}

// Export PDF
export function exporterPDF(documents: Document[], titre: string = 'Liste des documents') {
  const doc = new jsPDF()

  // En-tête
  doc.setFontSize(20)
  doc.setTextColor(211, 32, 39) // Rouge ACS
  doc.text('ACS - Assureurs Conseils Service', 105, 20, { align: 'center' })
  
  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.text(titre, 105, 30, { align: 'center' })

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 105, 38, { align: 'center' })

  // Tableau
  autoTable(doc, {
    startY: 45,
    head: [['Référence', 'Titre', 'Client', 'Risque', 'Type', 'Date']],
    body: documents.map(d => [
      d.reference,
      d.titre,
      d.client,
      d.risque,
      d.typeCourrier === 'ACS_VERS_CLIENT' ? 'ACS → Client' : 'ACS → Compagnie',
      d.date
    ]),
    headStyles: {
      fillColor: [211, 32, 39],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    margin: { top: 45 }
  })

  // Pied de page
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Page ${i} sur ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }

  // Téléchargement
  doc.save(`ACS_Documents_${new Date().toISOString().split('T')[0]}.pdf`)
}

// Export Excel
export function exporterExcel(documents: Document[], nomFichier: string = 'documents') {
  // Préparer les données
  const donnees = documents.map(d => ({
    'Référence': d.reference,
    'Titre': d.titre,
    'Client': d.client,
    'Risque': d.risque,
    'Type de courrier': d.typeCourrier === 'ACS_VERS_CLIENT' ? 'ACS → Client' : 'ACS → Compagnie',
    'Date': d.date,
    'Taille': d.taille
  }))

  // Créer le workbook
  const ws = XLSX.utils.json_to_sheet(donnees)

  // Ajuster la largeur des colonnes
  const colWidths = [
    { wch: 20 }, // Référence
    { wch: 40 }, // Titre
    { wch: 25 }, // Client
    { wch: 15 }, // Risque
    { wch: 20 }, // Type
    { wch: 12 }, // Date
    { wch: 10 }, // Taille
  ]
  ws['!cols'] = colWidths

  // Style de l'en-tête (première ligne)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
    if (!ws[cellAddress]) continue
    ws[cellAddress].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: 'D32027' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Documents')

  // Ajouter des métadonnées
  wb.Props = {
    Title: 'Export Documents ACS',
    Subject: 'Liste des documents',
    Author: 'ACS Archive System',
    CreatedDate: new Date()
  }

  // Téléchargement
  XLSX.writeFile(wb, `ACS_${nomFichier}_${new Date().toISOString().split('T')[0]}.xlsx`)
}

// Export CSV
export function exporterCSV(documents: Document[], nomFichier: string = 'documents') {
  const headers = ['Référence', 'Titre', 'Client', 'Risque', 'Type de courrier', 'Date', 'Taille']
  
  const csvContent = [
    headers.join(';'),
    ...documents.map(d => [
      d.reference,
      `"${d.titre}"`,
      d.client,
      d.risque,
      d.typeCourrier === 'ACS_VERS_CLIENT' ? 'ACS → Client' : 'ACS → Compagnie',
      d.date,
      d.taille
    ].join(';'))
  ].join('\n')

  // Ajouter BOM pour Excel
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `ACS_${nomFichier}_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
