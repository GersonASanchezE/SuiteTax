/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_BoletoBancarioLBRY_V2.0.js                  ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jun 17 2019  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

define(['N/search', 'N/record', './LMRY_libSendingEmailsLBRY_V2.0', './LMRY_BoletoBancarioBOALBRY_V2.0', './LMRY_BoletoBancarioITAULBRY_V2.0', './LMRY_BoletoBancarioBBLBRY_V2.0', './LMRY_BoletoBancarioBRDLBRY_V2.0', './LMRY_BoletoBancarioSTDLBRY_V2.0', './LMRY_BoletoBancarioCitibankLBRY_V2.0'],
  function (search, record, libraryMail, libraryBoa, libraryItau, libraryBB, libraryBradesco, librarySantander, libraryCitibank) {

    var LMRY_script = 'LMRY_BoletoBancarioLBRY_V2.0.js';

    function obtenerURLPdfBoletoBancario(idInvoice, fecha, type, transaction, idBr) {

      var configBoleto = '', pdfBanco = '', create_br = false, br = '';
      var status = 1;
      var jsonInstallments = '';

      // Búsqueda Invoice
      var resultInvoice = search.lookupFields({
        type: "invoice",
        id: idInvoice,
        columns: ["subsidiary", "custbody_lmry_paymentmethod"]
      });

      var subsidiary = "";
      if (resultInvoice["subsidiary"] && resultInvoice["subsidiary"].length) {
        subsidiary = resultInvoice["subsidiary"][0]["value"];
      }

      var paymentMethod = "";
      if (resultInvoice["custbody_lmry_paymentmethod"] && resultInvoice["custbody_lmry_paymentmethod"].length) {
        paymentMethod = resultInvoice["custbody_lmry_paymentmethod"][0]["value"];
      }

      licenses = libraryMail.getLicenses(subsidiary);

      var setupConfigBoleto, setupPdfBanco, setupPaymentMethod;
      // LatamReady - Setup Tax Subsidiary
      var setup_tax = search.create({
        type: 'customrecord_lmry_setup_tax_subsidiary',
        filters: [{
          name: 'custrecord_lmry_setuptax_subsidiary',
          operator: 'anyof',
          values: subsidiary
        },
        {
          name: 'isinactive',
          operator: 'is',
          values: 'F'
        }
        ],
        columns: ['custrecord_lmry_setuptax_cg_bank_default',
          'custrecord_lmry_setuptax_cg_bank_ticket',
          search.createColumn({
            name: 'custrecord_lmry_pdf_bank',
            join: 'CUSTRECORD_LMRY_SETUPTAX_CG_BANK_TICKET'
          }),
          "custrecord_lmry_setuptax_br_paymt_method"
        ]
      });
      // Rango de busqueda
      var result_tax = setup_tax.run().getRange({ start: 0, end: 1 });

      //SI TIENE SETUP TAX
      if (result_tax != null && result_tax.length > 0) {
        var columnas_setup = result_tax[0].columns;
        // Latam - BR Config Bank Default
        var defaultpdf = result_tax[0].getValue(columnas_setup[0]);
        if (defaultpdf == true || defaultpdf == 'T') {
          // Latam - BR Config Bank Ticket
          setupConfigBoleto = result_tax[0].getValue(columnas_setup[1]);
          // LatamReady - BR Config Bank ticket - PDF Banco
          setupPdfBanco = result_tax[0].getValue(columnas_setup[2]);
        }
        setupPaymentMethod = result_tax[0].getValue("custrecord_lmry_setuptax_br_paymt_method");
      }

      if (setupPaymentMethod && Number(setupPaymentMethod) != Number(paymentMethod)) {
        return "";
      }

      if (transaction == null || transaction == undefined || transaction == '1') {
        /*=====================================================================================
          Generación de boleto desde invoice (LatamReady - Invoice URET V2.0) o a través de
          proceso OWN (Facturación Electrónica)
        ======================================================================================*/

        // LatamReady - BR Transaction Fields
        var brTransFields = search.create({
          type: 'customrecord_lmry_br_transaction_fields',
          columns: ['custrecord_lmry_br_config_bank_ticket', 'custrecord_lmry_br_pdf_bank', 'custrecord_lmry_br_bb_status', 'custrecord_lmry_br_installments'],
          filters: [
            ['isinactive', 'is', 'F'], 'AND', ['custrecord_lmry_br_related_transaction', 'anyof', [idInvoice]]
          ]
        });

        brTransFields = brTransFields.run().getRange(0, 1);

        if (brTransFields != null && brTransFields != '' && brTransFields != undefined) {
          var estado = brTransFields[0].getValue('custrecord_lmry_br_bb_status');
          configBoleto = brTransFields[0].getValue('custrecord_lmry_br_config_bank_ticket');
          pdfBanco = brTransFields[0].getValue('custrecord_lmry_br_pdf_bank');
          jsonInstallments = brTransFields[0].getValue('custrecord_lmry_br_installments');

          create_br = true;
          if (estado != null && estado != '' && estado != 0) {
            status = estado;
          }
        } else {
          create_br = false;
        }

        // Solo si tiene no tiene configurado el boleto en Transaction Fields
        if (configBoleto == null || configBoleto == '' || configBoleto == undefined) {
          configBoleto = setupConfigBoleto;
          pdfBanco = setupPdfBanco;
        }

      } else if (transaction == '2') {
        /*=====================================================================================
          Generación de boleto desde Transaction Field (LatamReady - BR Trans Fields URET V2.0)
        ======================================================================================*/
        create_br = true;

        // LatamReady - BR Transaction Fields
        var br_transaction = search.lookupFields({
          type: 'customrecord_lmry_br_transaction_fields',
          columns: ['custrecord_lmry_br_config_bank_ticket', 'custrecord_lmry_br_pdf_bank', 'custrecord_lmry_br_bb_status', 'custrecord_lmry_br_installments'],
          id: idBr
        });

        // Latam - BR Config Bank Ticket
        if (br_transaction['custrecord_lmry_br_config_bank_ticket'].length > 0) {
          configBoleto = br_transaction['custrecord_lmry_br_config_bank_ticket'][0].value;
        }

        // Latam - BR PDF Bank
        if (br_transaction['custrecord_lmry_br_pdf_bank'].length > 0) {
          pdfBanco = br_transaction['custrecord_lmry_br_pdf_bank'][0].value;
        }

        // Latam - BR BB Status
        if (br_transaction['custrecord_lmry_br_bb_status'].length > 0) {
          status = br_transaction['custrecord_lmry_br_bb_status'][0].value;
        }

        jsonInstallments = br_transaction['custrecord_lmry_br_installments'];

      }

      log.error('BoletoBancario', "transaction: " + transaction + " - pdfBanco: " + pdfBanco + " - configBoleto: " + configBoleto);

      var boleto = '';

      // Solo si tiene configurado el boleto
      if (configBoleto != null && configBoleto != '' && configBoleto != undefined) {

        switch (pdfBanco) {
          case '1':
            //Boleto BOA
            if (libraryMail.getAuthorization(386, licenses) == true) {
              boleto = libraryBoa.obtenerURLPdfBoletoBancario(idInvoice, configBoleto, status, fecha, jsonInstallments, type);
            }
            break;

          case '2':
            //Boleto ITAU
            if (libraryMail.getAuthorization(447, licenses) == true) {
              boleto = libraryItau.obtenerURLPdfBoletoBancarioITAU(idInvoice, configBoleto, status, jsonInstallments, type);
            }
            break;

          case '3':
            //Boleto Banco do Brasil
            if (libraryMail.getAuthorization(446, licenses) == true && create_br == true) {
              boleto = libraryBB.obtenerURLPdfBoletoBancario(idInvoice, configBoleto, status, jsonInstallments, type);
            }
            break;

          case '4':
            //Boleto Banco Bradesco
            if (libraryMail.getAuthorization(445, licenses) == true && create_br == true) {
              boleto = libraryBradesco.obtenerURLPDFBoletoBancario(idInvoice, configBoleto, status, jsonInstallments, type);
            }
            break;

          case '5':
            //Boleto Banco Santander
            if (libraryMail.getAuthorization(530, licenses) == true && create_br == true) {
              boleto = librarySantander.obtenerURLPDFBoletoBancario(idInvoice, configBoleto, status, jsonInstallments, type);
            }
            break;

          case '6':
            //Boleto Banco Citibank
            if (libraryMail.getAuthorization(531, licenses) == true) {
              boleto = libraryCitibank.obtenerURLPDFBoletoBancario(idInvoice, configBoleto, status, jsonInstallments, type);
            }
            break;

        }
      }
      return boleto;

    }

    return {
      obtenerURLPdfBoletoBancario: obtenerURLPdfBoletoBancario
    };
  });
