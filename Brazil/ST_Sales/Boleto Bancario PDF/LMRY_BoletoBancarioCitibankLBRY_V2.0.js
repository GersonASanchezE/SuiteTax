/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_BoletoBancarioCitibankLBRY_V2.0.js          ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Sep 09 2020  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NModuleScope Public
 */

define(['N/record', 'N/file', 'N/record', 'N/render', 'N/url', 'N/log', 'N/xml', 'N/https', 'N/search', 'N/runtime', 'N/format', 'N/format/i18n', 'N/config', './LMRY_libSendingEmailsLBRY_V2.0'],
  function(record, file, record, render, url, log, xml, https, search, runtime, format, format2, config, libraryMail) {

    var LMRY_script = 'LMRY_BoletoBancarioCitibankLBRY_V2.0.js';
    var LANGUAGUE = '';
    var MSJ_ANULADO = '';
    var ST_FEATURE = false;

    //Datos de SUBSIDIARIA
    var ID_SUBSIDIARY = '';
    var NAME_SUBSIDIARY = '';
    var CNPJ_SUBSIDIARY = '';
    var ADDRESS_SUBSIDIARY = '';
    var ADDRESS_SUB_CABECERA = '';

    //Datos del CUSTOMER
    var ID_CUSTOMER = '';
    var NAME_CUSTOMER = '';
    var CNPJ_CUSTOMER = '';
    var ADDRESS_CUSTOMER1 = '';
    var ADDRESS_CUSTOMER2 = '';

    //Datos del SACADOR / AVALISTA
    var ID_SACADOR_AVALISTA = '';
    var NAME_SACADOR = '';
    var CNPJ_SACADOR = '';
    var ADDRESS_SACADOR = ''

    //Datos del INVOICE
    var ID_INV = '';
    var DATE_INV = '';
    var DATE_VENC = '';
    var NRO_DOCUMENT = '';
    var CURRENCY_INV = '';
    var AMOUNT_INV = '';
    var AMOUNT_LETTERS_INV = ''; //Monto en letras
    var COD_OCURRENCIA = '';

    //Datos record LatamReady - BR Config Bank Ticket
    var ID_RECORD = '';
    var AGENCY = '';
    var BENEFICIARY_CODE = '';
    var AGENCY_BENEFICIARY_CODE = '';
    var BANK_CODE = '';
    var PLACE_PAYMENT = '';
    var ACCEPTANCE = '';
    var DV_CODE = '';
    var DOCUMENT_SPECIE = '';
    var CARTERA = '';
    var CUSTOM_FIELD = ''; //Instrucciones
    var LOGO_BANK = '';
    var ID_CURRENCY = '';
    var CURRENCY_SYMBOL = '';
    var INSTRUCTIONS = '';
    var COLLECTION_ACCOUNT = '';

    //Código de barras
    var BARCODE = 0;

    //Línea Digital
    var DIGITAL_LINE = 0;

    //URL Logo del boleto bancario
    var URL_LOGO = '';

    //Link acortado del boleto bancario
    var SHORT_LINK = '';
    var HOST = '';
    var FLAG = false;
    var BOLETOS = [];
    var TYPE = '';

    //Url de web service acortador de link
    const WS_URL = 'https://tstdrv1930452.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=692&deploy=1&compid=TSTDRV1930452&h=42860c3b2ce293fa7084';

    var duedate = "";

    var licenses = [];

    function obtenerURLPDFBoletoBancario(id_invoice, id_recordConfigBankTicket, statusCodOcurencia, installment, type) {
      try {

        ID_INV = id_invoice;
        ID_RECORD = id_recordConfigBankTicket;
        COD_OCURRENCIA = statusCodOcurencia;
        TYPE = type;

        LANGUAGUE = runtime.getCurrentScript().getParameter({
          name: 'LANGUAGE'
        });
        LANGUAGUE = LANGUAGUE.substring(0, 2);

        //Marca de agua en caso de Pedido de Baixa (Codigo de Ocurrencia)
        switch (LANGUAGUE) {
          case 'pt':
            MSJ_ANULADO = '<p valign="middle" align="center" rotate="-60" style="font-size:150px;color:alpha(8%,#ff0000)">PEDIDO DE BAIXA</p>';
            break;

          case 'es':
            MSJ_ANULADO = '<p valign="middle" align="center" rotate="-60" style="font-size:140px;color:alpha(8%,#ff0000)">SOLICITUD DE BAJA</p>';
            break;

          default:
            MSJ_ANULADO = '<p valign="middle" align="center" rotate="-60" style="font-size:130px;color:alpha(8%,#ff0000)">WRITE OFF REQUEST</p>';
        }

        obtenerDatosInvoice();
        obtenerDatosSubsidiaria();
        obtenerDatosCustomer();
        obtenerDatosConfigBankTicket();
        obtenerEspecieDOC();
        obtenerDatosSacadorAvalista();
        formarInstrucciones();

        //Nombre del Dominio del Ambiente
        HOST = url.resolveDomain({
          hostType: url.HostType.APPLICATION
        });

        //URL Logo Santander
        URL_LOGO = 'https://' + HOST + file.load(LOGO_BANK).url;

        //Crea la carpeta "Latam BR - PDF Boleto Bancario" si no existe, en dicha carpeta se guardaran los Boletos Bancarios
        search_folder();

        BOLETOS = formarInstallments(installment);

        return BOLETOS;

      } catch (err) {
        libraryMail.sendemail(' [ obtenerURLPdfBoletoBancario ] ' + err, LMRY_script);
      }
    }


    function formarInstallments(installment) {
      try {
        var linkBoleto = '';
        var arrayBoletos = [];
        //Se obtiene el Id de la carpeta "Latam BR - PDF Boleto Bancario"
        FOLDER_BR = runtime.getCurrentScript().getParameter({
          name: 'custscript_lmry_br_boleto_bancario'
        });

        if (FOLDER_BR) {

            linkBoleto = formarPDF(AMOUNT_INV, AMOUNT_LETTERS_INV, '');
            arrayBoletos.push(linkBoleto);

            var installments = runtime.isFeatureInEffect({
              feature: "installments"
            });

            if (installments && libraryMail.getAuthorization(536, licenses)) {

              var jsonInstallments = [];

              if (installment != '' && installment != null) {
                jsonInstallments = JSON.parse(installment);
              }

              if (Object.keys(jsonInstallments).length) {
                for (var idInstallment in jsonInstallments) {
                  var monto = Math.round(parseFloat(jsonInstallments[idInstallment]['amount']) * 100) / 100;

                  if (jsonInstallments[idInstallment]['wht'] && FLAG) {
                    var retencion = Math.round(parseFloat(jsonInstallments[idInstallment]['wht']) * 100) / 100;
                    retencion = retencion.toFixed(2);
                    monto = Math.round((parseFloat(monto) - parseFloat(retencion)) * 100) / 100;
                  }

                  var numFormatter1 = format2.getNumberFormatter(); //Obtiene el formato de numero que se está utilizando
                  montoText = numFormatter1.format({
                    number: monto
                  });

                  monto = monto.toFixed(2);

                  if (jsonInstallments[idInstallment]['duedate']) {
                      duedate = jsonInstallments[idInstallment]['duedate'];
                      DATE_VENC = formatoFecha(jsonInstallments[idInstallment]['duedate']);
                  }

                  var link = formarPDF(monto, montoText, idInstallment);
                  arrayBoletos.push(link);
                }
              } else {
                var searchInstallments = search.create({
                      type: "invoice",
                      filters:
                          [
                              ["internalid", "anyof", ID_INV], "AND",
                              ["mainline", "is", "T"]
                          ],
                      columns: [
                          search.createColumn({
                              name: "installmentnumber",
                              join: "installment",
                              sort: search.Sort.ASC
                          }),
                          "installment.amount",
                          "installment.duedate"
                      ],
                      settings: [search.createSetting({ name: 'consolidationtype', value: 'NONE' })]
                  });

                var resultInstallments = searchInstallments.run().getRange(0, 100);

                var row = resultInstallments[0].columns;
                var installNumber = resultInstallments[0].getValue(row[0]);

                if (resultInstallments != null && resultInstallments != '' && installNumber != '' && installNumber!= null) {
                  for (var i = 0; i < resultInstallments.length; i++) {
                    var row = resultInstallments[i].columns;
                    var internalId = resultInstallments[i].getValue(row[0]);
                    var monto = resultInstallments[i].getValue(row[1]);
                    var due_date = resultInstallments[i].getValue(row[2]);
                    monto = parseFloat(monto);

                    //Parseando el monto a float
                    var numberMonto = format.parse({
                      value: monto,
                      type: format.Type.FLOAT
                    });

                    var numFormatter1 = format2.getNumberFormatter(); //Obtiene el formato de numero que se está utilizando
                    var montoText = numFormatter1.format({
                      number: numberMonto
                    });

                    monto = monto.toFixed(2);

                    if(due_date){
                      duedate = due_date;
                      DATE_VENC = formatoFecha(duedate);
                    }

                    var link = formarPDF(monto, montoText, internalId);
                    arrayBoletos.push(link);

                  }
                }
            }
          }

          if (TYPE == '1') {
            record.submitFields({
              type: 'invoice',
              id: ID_INV,
              values: {
                'custbody_lmry_informacion_adicional': arrayBoletos
              },
              options: {
                ignoreMandatoryFields: true,
                enableSourcing: true,
                disableTriggers: true
              }
            });
          }

          return arrayBoletos;
        }
      } catch (err) {
        libraryMail.sendemail(' [ formarInstallments ] ' + err, LMRY_script);
      }
    }

    function formarPDF(monto, montoText, cod) {
      try {
        var shortLink = '';
        var nossoNumber = formarNossoNumero(cod);
        obtenerCodigoBarras(monto, nossoNumber);
        obtenerLineaDigital();

        var htmlFinal = '';
        htmlFinal += reciboPagador(montoText, nossoNumber);
        htmlFinal += fichaCompensacion(montoText, nossoNumber);

        var xml = "<?xml version=\"1.0\"?><!DOCTYPE pdf PUBLIC \"-//big.faceless.org//report\" \"report-1.1.dtd\">";
        xml += "<pdf> <head> <macrolist><macro id=\"marca\">" + MSJ_ANULADO + "</macro></macrolist>";
        if (COD_OCURRENCIA == 2) {
          xml += "</head><body font-size=\"12\" size=\"A4\" background-macro=\"marca\"><h3></h3>";
        } else {
          xml += "</head><body font-size=\"12\" size=\"A4\"><h3></h3>";
        }
        xml += htmlFinal;
        xml += "</body> </pdf>";

        var myFileObj = render.xmlToPdf({
          xmlString: xml
        });

        //Nombre del Boleto Bancario
        if (cod != '') {
          myFileObj.name = 'BR_BB_CITIBANK_' + ID_INV + '_' + cod + '.pdf';
        } else {
          myFileObj.name = 'BR_BB_CITIBANK_' + ID_INV + '.pdf';
        }

        myFileObj.folder = FOLDER_BR;
        myFileObj.isOnline = true;
        var id_pdf = myFileObj.save();

        var url_archivo_pdf = file.load({
          id: id_pdf
        });
        var urlBoletoBancarioPdf = 'https://' + HOST + url_archivo_pdf.url;

        //Acortador del link
        var account = runtime.accountId;
        shortLink = libraryMail.acortadorDeLink(WS_URL, urlBoletoBancarioPdf, account);
        return shortLink;

      } catch (err) {
        libraryMail.sendemail(' [ formarPDF ] ' + err, LMRY_script);
      }
    }

    function obtenerDatosInvoice() {
      try {

        //Se recuperan los datos del Invoice necesarios para formar boleto bancario
        var recordInvoice = search.lookupFields({
          type: search.Type.INVOICE,
          id: ID_INV,
          columns: ['internalid', 'subsidiary', 'entity', 'trandate', 'duedate', 'custbody_lmry_num_preimpreso', 'fxamount', 'custbody_lmry_wtax_code_des', 'custbody_lmry_wtax_amount', 'currency']
        });

        ID_SUBSIDIARY = recordInvoice.subsidiary[0].value;
        ID_CUSTOMER = recordInvoice.entity[0].value;
        NRO_DOCUMENT = recordInvoice.internalid[0].value;
        CURRENCY_INV = recordInvoice.currency[0].value;

        DATE_INV = recordInvoice.trandate;
        DATE_INV = formatoFecha(DATE_INV);

        duedate = recordInvoice.duedate;
        if (duedate) {
          DATE_VENC = formatoFecha(duedate);
        }

        AMOUNT_INV = recordInvoice.fxamount;
        var numberMonto = format.parse({
          value: AMOUNT_INV,
          type: format.Type.FLOAT
        });

        //Obtiene el formato del monto del invoice
        var numFormatter1 = format2.getNumberFormatter();
        AMOUNT_LETTERS_INV = numFormatter1.format({
          number: numberMonto
        });

        /******************************************************************+******************************************
          - Descripción: Si esta activo el Feature  BR - LATAM WHT TAX y el campo tax_code_des tiene la descripción
            Latam - WHT Tax , Se resta el monto del invoice con el monto de la retencion (ID:custbody_lmry_wtax_amount)
        ***************************************************************************************************************/
        var tax_code_des = recordInvoice.custbody_lmry_wtax_code_des;

        licenses = libraryMail.getLicenses(ID_SUBSIDIARY);

        if (libraryMail.getAuthorization(416, licenses) == true && tax_code_des == 'Latam - WHT Tax') {
          FLAG = true;
          var retencion = recordInvoice.custbody_lmry_wtax_amount;
          AMOUNT_INV = parseFloat(AMOUNT_INV) - parseFloat(retencion);

          //Obtiene el formato del monto del invoice
          var numFormatter1 = format2.getNumberFormatter();
          AMOUNT_LETTERS_INV = numFormatter1.format({
            number: AMOUNT_INV
          });

          AMOUNT_INV = Math.round(parseFloat(AMOUNT_INV) * 100) / 100;
        }

      } catch (err) {
        libraryMail.sendemail(' [ obtenerDatosInvoice ] ' + err, LMRY_script);
      }
    }

    function obtenerDatosSubsidiaria() {
      try {

        // Recuperamos si la cuenta es SuiteTax
        ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        //Se recuperan los datos de la Subsidiaria necesarios para formar boleto bancario
        var recordSub = record.load({
          type: record.Type.SUBSIDIARY,
          id: ID_SUBSIDIARY,
          isDynamic: true
        });

        /**
         * Para SuiteTax
         */
        if(ST_FEATURE || ST_FEATURE === "T") {
          var transObj = record.load({
            type: 'invoice',
            id: NRO_DOCUMENT,
            isDynamic: true
          });
          var transaction_nexys = transObj.getValue({fieldId: 'nexus'});
          var taxregnum_lines_subsidiaries = recordSub.getLineCount({ sublistId: 'taxregistration' });
          for(var x = 0; x < taxregnum_lines_subsidiaries; x++) {
            var subsidiary_nexus = recordSub.getSublistValue({ sublistId: 'taxregistration', fieldId: 'nexus', line: x });
            if(transaction_nexys === subsidiary_nexus){
              var subsidiary_cnpj = recordSub.getSublistValue({ sublistId: 'taxregistration', fieldId: 'taxregistrationnumber', line: x });
              break;
            }
          }
        }

        //Nombre de la subsidiaria
        var nom_sub = recordSub.getValue('legalname');
        if (nom_sub) {
          nom_sub = nom_sub.substring(0, 30);
          NAME_SUBSIDIARY = reemplazarCaracteresEspeciales(nom_sub);
        } else {
          var subsi_name = recordSub.getValue('name');
          if (subsi_name) {
            subsi_name = subsi_name.substring(0, 30);
            NAME_SUBSIDIARY = reemplazarCaracteresEspeciales(subsi_name);
          }
        }

        //CNPJ de la subsidiaria
        var cnpj_sub = "";
        if(!ST_FEATURE || ST_FEATURE === "F") {
          cnpj_sub = recordSub.getValue({ fieldId: 'federalidnumber' });
        } else {
          cnpj_sub = subsidiary_cnpj;
        }
        if (cnpj_sub) {
          cnpj_sub = reemplazarCaracteresEspeciales(cnpj_sub);
          CNPJ_SUBSIDIARY = ' - CNPJ: ' + cnpj_sub;
        }

        //Dirección de la subsidiaria
        var address_sub = recordSub.getValue('mainaddress_text');
        if (address_sub) {
          address_sub = address_sub.substring(0, 60);
          ADDRESS_SUBSIDIARY = reemplazarCaracteresEspeciales(address_sub);
          var addressSubCabecera = ADDRESS_SUBSIDIARY.substring(0, 30);
          ADDRESS_SUB_CABECERA = '/' + ' ' + addressSubCabecera;
        }

      } catch (err) {
        libraryMail.sendemail(' [ obtenerDatosSubsidiaria ] ' + err, LMRY_script);
      }
    }

    function obtenerDatosCustomer() {
      try {

        // Verificamos si la cuenta es SuiteTax
        ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var customer_columns = ['isperson', 'firstname', 'lastname', 'companyname', 'custentity_taxpayer_number_sv'];

        /**
         * Para SuiteTax
         */
        if (ST_FEATURE || ST_FEATURE === "T") {
          var transObj = record.load({
            type: 'invoice',
            id: NRO_DOCUMENT,
            isDynamic: true
          });
          var customer_cnpj = transObj.getText({ fieldId: 'entitytaxregnum' });
        } else {
          customer_columns.push("vatregnumber");
        }

        //Se recuperan los datos del Customer necesarios para formar boleto bancario
        var recordCustomer = search.lookupFields({
          type: search.Type.CUSTOMER,
          id: ID_CUSTOMER,
          columns: customer_columns
        });

        var nom_customer = '';
        var typeCustomer = recordCustomer.isperson;
        var abrevCNPJ = ' - CNPJ: ';
        //Si el Customer es persona natural typeCustomer es true
        if (typeCustomer == 'T' || typeCustomer == true) {
          var firtsName = recordCustomer.firstname
          var lastName = recordCustomer.lastname;
          nom_customer = firtsName + ' ' + lastName;
          abrevCNPJ = ' - CPF: ';
        } else {
          nom_customer = recordCustomer.companyname;
        }

        // Nombre del Customer
        if (nom_customer) {
          nom_customer = nom_customer.substring(0, 30);
          NAME_CUSTOMER = reemplazarCaracteresEspeciales(nom_customer);
        }

        //CNPJ del Customer
        var cnpj_customer = "";
        if(!ST_FEATURE || ST_FEATURE === "F") {
          cnpj_customer = recordCustomer.vatregnumber;
        } else {
          cnpj_customer = customer_cnpj;
        }
        if (cnpj_customer) {
          cnpj_customer = reemplazarCaracteresEspeciales(cnpj_customer);
          CNPJ_CUSTOMER = abrevCNPJ + cnpj_customer;
        }

        // Dirección del Customer
        var billAdress1 = '';
        // Numero de la direccion
        var billAdress2 = '';
        // Complemento
        var billAdress3 = '';
        // Barrio
        var billAdress4 = '';
        // Ciudad
        var billAdress5 = '';
        // Provincia
        var billAdress6 = '';
        // Zip
        var billAdress7 = '';
        // Country
        var billAdress8 = '';

        // Campos de la direccion
        var col_billadd = ['billingAddress.address1', 'billingAddress.custrecord_lmry_address_number',
          'billingAddress.custrecord_lmry_addr_reference', 'billingAddress.address2',
          'billingAddress.custrecord_lmry_addr_city', 'billingAddress.custrecord_lmry_addr_prov_acronym',
          'billingAddress.zip', 'billingAddress.country'
        ]

        // Busqueda en el record de direcciones
        var busqAddressRece = search.create({
          type: 'transaction',
          columns: col_billadd,
          filters: [
            ["internalid", "anyof", ID_INV],
            "AND",
            ["mainline", "is", "T"]
          ]
        });

        var resultAddress = busqAddressRece.run().getRange(0, 10);

        if (resultAddress != null && resultAddress.length != 0) {
          row = resultAddress[0].columns;
          billAdress1 = resultAddress[0].getValue(row[0]);
          if (billAdress1 == '' || billAdress1 == null) {
            billAdress1 = '';
          }
          // Numero de la direccion
          billAdress2 = resultAddress[0].getValue(row[1]);
          if (billAdress2 == '' || billAdress2 == null) {
            billAdress2 = '';
          }

          // Complemento
          billAdress3 = resultAddress[0].getValue(row[2]);
          if (billAdress3 == '' || billAdress3 == null) {
            billAdress3 = '';
          }

          // Barrio
          billAdress4 = resultAddress[0].getValue(row[3]);
          if (billAdress4 == '' || billAdress4 == null) {
            billAdress4 = '';
          }

          // Ciudad
          billAdress5 = resultAddress[0].getText(row[4]);
          if (billAdress5 == '' || billAdress5 == null) {
            billAdress5 = '';
          }

          // Provincia
          billAdress6 = resultAddress[0].getValue(row[5]);
          if (billAdress6 == '' || billAdress6 == null) {
            billAdress6 = '';
          }

          // Zip
          billAdress7 = resultAddress[0].getValue(row[6]);
          if (billAdress7 == '' || billAdress7 == null) {
            billAdress7 = '';
          }

          billAdress7 = billAdress7.replace(/[^0-9]/g, '');

          // Country
          billAdress8 = resultAddress[0].getValue(row[7]);
          if (billAdress8 == '' || billAdress8 == null) {
            billAdress8 = '';
          }

        }

        // Arma la direccion  (primera fila)
        var address_customer1 = billAdress1 + ' ' + billAdress2 + ' ' +
          billAdress3 + ' ' + billAdress4 + ' ' + billAdress8;

        if (address_customer1) {
          ADDRESS_CUSTOMER1 = reemplazarCaracteresEspeciales(address_customer1);
        }

        // Arma la direccion  (segunda fila)
        var address_customer2 = billAdress5 + ' ' + billAdress6 + ' ' + billAdress7;

        if (address_customer2) {
          ADDRESS_CUSTOMER2 = reemplazarCaracteresEspeciales(address_customer2);
        }

      } catch (err) {
        libraryMail.sendemail(' [ obtenerDatosCustomer ] ' + err, LMRY_script);
      }
    }

    function obtenerDatosSacadorAvalista() {
      try {
        if (ID_SACADOR_AVALISTA != '') {

          // Verificamos si la cuenta es SuiteTax
          ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

          var avalistaColumns = ['isperson', 'firstname', 'lastname', 'companyname', 'address1', 'address2', 'city', 'country'];
          if(ST_FEATURE == true || ST_FEATURE == "T") {
            avalistaColumns.push("defaulttaxreg");
          } else {
            avalistaColumns.push("vatregnumber");
          }

          var recordSacador = search.lookupFields({
            type: search.Type.VENDOR,
            id: ID_SACADOR_AVALISTA,
            columns: avalistaColumns
          });

          var nom_sacador = '';
          var typeSacador = recordSacador.isperson;

          //Si el Customer es persona natural typeCustomer es true
          if (typeSacador == 'T') {
            var firtsName = recordSacador.firstname
            var lastName = recordSacador.lastname;

            nom_sacador = firtsName + ' ' + lastName

          } else {
            nom_sacador = recordSacador.companyname;
          }

          // NOMBRE DEL SACADOR/AVALISTA
          if (nom_sacador) {
            NAME_SACADOR = nom_sacador.substring(0, 30);
            NAME_SACADOR = reemplazarCaracteresEspeciales(NAME_SACADOR);
          }

          //CNPJ DEL SACADOR/AVALISTA
          var cnpj_sacador = "";
          if(ST_FEATURE == true || ST_FEATURE == "T") {
            cnpj_sacador = recordSacador.defaulttaxreg;
          } else {
            cnpj_sacador = recordSacador.vatregnumber;
          }
          if (cnpj_sacador) {
            CNPJ_SACADOR = reemplazarCaracteresEspeciales(cnpj_sacador);
            CNPJ_SACADOR = ' - CNPJ: ' + CNPJ_SACADOR;
          }

          //ADDRESS DEL SACADOR/AVALISTA
          var bill_address1 = recordSacador.address1;
          if (bill_address1 == '' || bill_address1 == null) {
            bill_address1 = '';
          }

          var bill_address2 = recordSacador.address2;
          if (bill_address2 == '' || bill_address2 == null) {
            bill_address2 = '';
          }

          var bill_address3 = recordSacador.city;
          if (bill_address3 == '' || bill_address3 == null) {
            bill_address3 = '';
          }

          var bill_address4 = recordSacador.country[0];
          if (bill_address4 == '' || bill_address4 == null) {
            bill_address4 = '';
          } else {
            bill_address4 = recordSacador.country[0].value;
          }

          // Arma la dirección
          var address_sacador = bill_address1 + ' ' + bill_address2 + ' ' +
            bill_address3 + ' ' + bill_address4;

          if (address_sacador) {
            ADDRESS_SACADOR = reemplazarCaracteresEspeciales(address_sacador);
            ADDRESS_SACADOR = '/' + ' ' + ADDRESS_SACADOR
          }

        }

      } catch (err) {
        libraryMail.sendemail(' [ obtenerDatosSacadorAvalista ] ' + err, LMRY_script);
      }

      return true;
    }

    function obtenerDatosConfigBankTicket() {
      try {

        //Se recuperan los datos del record "LatamReady - BR Config Bank Ticket" necesarios para formar boleto bancario
        var searchConfigSubsiBank = search.create({
          type: 'customrecord_lmry_br_config_bank_ticket',
          columns: [{
            name: 'custrecord_lmry_beneficiary_code'
          }, {
            name: 'custrecord_lmry_code_bank'
          }, {
            name: 'custrecord_lmry_bank_agency'
          }, {
            name: 'custrecord_lmry_bank_place_of_payment'
          }, {
            name: 'custrecord_lmry_bank_code_cartera'
          }, {
            name: 'custrecord_lmry_bank_accept_bank_ticket'
          }, {
            name: 'custrecord_lmry_bank_check_digit'
          }, {
            name: 'custrecord_lmry_br_docu_specie_siglas',
            join: 'CUSTRECORD_LMRY_BANK_ESPECIE_DOC',
            label: "BR Siglas"
          }, {
            name: 'internalid'
          }, {
            name: 'custrecord_lmry_id_field'
          }, {
            name: 'custrecord_lmry_bank_logo'
          }, {
            name: 'custrecord_lmry_collection_account'
          }],
          filters: ['internalid', 'is', ID_RECORD]
        });

        var searchResult = searchConfigSubsiBank.run().getRange(0, 1);

        if (searchResult != '' && searchResult != null) {
          var columns = searchResult[0].columns;

          BENEFICIARY_CODE = searchResult[0].getValue(columns[0]);
          var agencia = searchResult[0].getValue(columns[2]);

          if (agencia) {
            AGENCY_BENEFICIARY_CODE = agencia + " / " + BENEFICIARY_CODE;
            AGENCY = agencia;

          } else {
            AGENCY_BENEFICIARY_CODE = BENEFICIARY_CODE;
          }

          BANK_CODE = searchResult[0].getValue(columns[1]);
          PLACE_PAYMENT = searchResult[0].getValue(columns[3]);
          CARTERA = searchResult[0].getValue(columns[4]);
          DV_CODE = searchResult[0].getValue(columns[6]);
          DOCUMENT_SPECIE = searchResult[0].getValue(columns[7]);

          var aceptacion = searchResult[0].getValue(columns[5]);

          if (aceptacion != null && aceptacion != '') {
            if (aceptacion == 1) {
              ACCEPTANCE = "A";
            } else {
              ACCEPTANCE = "N";
            }
          }

          //Campo personalizado para la impresión en las instrucciones del PDF, que puede contener: ID de campos de tipo custbody, Texto libre y salto de linea(enter)
          CUSTOM_FIELD = searchResult[0].getValue(columns[9]);

          //Logo de Banco
          LOGO_BANK = searchResult[0].getValue(columns[10]);

          //Cuenta de cobranza
          COLLECTION_ACCOUNT = searchResult[0].getValue(columns[11]);

          var searchConfigCurrency = search.create({
            type: 'customrecord_lmry_br_config_currency',
            columns: [{
              name: 'custrecord_lmry_br_config_currency_name'
            }, {
              name: 'custrecord_lmry_br_config_currency_cod'
            }, {
              name: 'custrecord_lmry_br_config_currency_form'
            }],
            filters: ['custrecord_lmry_br_config_currency_bank', 'is', ID_RECORD]
          });

          var searchResultCurrency = searchConfigCurrency.run().getRange(0, 1000);
          if (searchResultCurrency != '' && searchResultCurrency != null) {
            for (var j = 0; j < searchResultCurrency.length; j++) {

              var name_currency = searchResultCurrency[j].getValue('custrecord_lmry_br_config_currency_name');

              if (name_currency == CURRENCY_INV) {
                var code_currency = searchResultCurrency[j].getValue('custrecord_lmry_br_config_currency_cod');
                var format_currency = searchResultCurrency[j].getValue('custrecord_lmry_br_config_currency_form');

                ID_CURRENCY = code_currency;
                CURRENCY_SYMBOL = format_currency;

              }
            }

          }
        }

      } catch (err) {
        libraryMail.sendemail(' [ obtenerDatosConfigBankTicket ] ' + err, LMRY_script);
      }

    }

    function formarNossoNumero(id_installment) {
      try {
        //Se forma Nosso Numero (11 dígitos + Dígito verificador)
        var brNossoNumero = '';
        var nossoNumber = '';
        var idTransactionFields = 0;

        if(id_installment!= null && id_installment!= ''){
          nossoNumber= ID_INV+id_installment;
          nossoNumber = nossoNumber.toString();
        }else{
          nossoNumber= ID_INV.toString();
        }

        while (nossoNumber.length < 11) {
          nossoNumber = '0' + nossoNumber;
        }

        var dvNossoNumero = calcularDVNossoNumero(nossoNumber);
        nossoNumber = nossoNumber + dvNossoNumero;
        return nossoNumber;

      } catch (err) {
        libraryMail.sendemail(' [ obtenerDatosConfigBankTicket ] ' + err, LMRY_script);
      }
    }

    function calcularDVNossoNumero(nosso_number) {
      try {

        var cadena = nosso_number;
        var digitoVerificador;
        var vector = [];
        var suma = 0;
        var digitoMultiplicado;
        var t = 2;

        for (var i = cadena.length - 1; i >= 0; i--) {
          digito = cadena[i];
          digito_int = parseInt(digito);
          vector.push(digito_int);
        }

        for (var j = 0; j < vector.length; j++) {
          if (t <= 9) {
            digitoMultiplicado = vector[j] * t;
            t++;
          } else {
            t = 2;
            digitoMultiplicado = vector[j] * t;
            t++;
          }
          var suma = suma + digitoMultiplicado;
        }

        var resto = suma % 11;
        digitoVerificador = 11 - resto;

        if (resto == 1 || resto == 0) {
          digitoVerificador = 0;
        }

        return digitoVerificador;

      } catch (err) {
        libraryMail.sendemail(' [ calcularDVNossoNumero ] ' + err, LMRY_script);
      }
    }

    function formarInstrucciones() {
      try {

        //Formar instrucciones según campo CUSTOM FIELD del record "LatamReady - BR Config Bank Ticket"
        var vector_custom_field = [];
        vector_custom_field = CUSTOM_FIELD.split('|');

        //vector para el SALTO DE LINEA y el TEXTO LIBRE, en este vector se guarda la data junto con su posicion correspondiente
        var vector_data_pos = [];
        //vector para los ID DE LOS CAMPOS DE TIPO CUSTBODY, en este vector se guarda la data junto con su posicion correspondiente
        var vector_id = [];

        for (var t = 0; t < vector_custom_field.length; t++) {
          //Si contiene la palabra enter, se realizará un salto de linea
          if ((vector_custom_field[t]).toLowerCase() == 'enter') {
            var enter = '<br/>'
            vector_data_pos[t] = enter;

          } else {
            var ultimaPos = vector_custom_field[t].length;
            //Si la palabra esta dentro de llaves, son ID de los campos tipo custbody
            if (vector_custom_field[t].substring(0, 1) == '{' && vector_custom_field[t].substring(ultimaPos - 1, ultimaPos) == '}') {
              vector_id[t] = vector_custom_field[t].substring(1, ultimaPos - 1);
            }
            //Si la palabra esta dentro de corchetes, son texto Libre
            if (vector_custom_field[t].substring(0, 1) == '[' && vector_custom_field[t].substring(ultimaPos - 1, ultimaPos) == ']') {
              var textoLibre = vector_custom_field[t].substring(1, ultimaPos - 1);
              vector_data_pos[t] = textoLibre;
            }
          }

        }

        var vector_cadena_final = [];

        var recordInvoice = search.lookupFields({
          type: search.Type.INVOICE,
          id: ID_INV,
          columns: vector_id
        });

        for (var pos = 0; pos < vector_id.length; pos++) {
          if (vector_id[pos]) {

            var name_id = vector_id[pos];
            var valor_id = recordInvoice[name_id];
            var type_valor_id = typeof valor_id;

            if (type_valor_id == 'object') {
              valor_id = recordInvoice[name_id][0].text;
            }

            valor_id = reemplazarCaracteresEspeciales(valor_id);

            vector_cadena_final[pos] = valor_id;
          }
        }

        //Guardando los valores de linea de salto y los valores de texto fijo
        for (var pos = 0; pos < vector_data_pos.length; pos++) {

          var enter_textoFijo = vector_data_pos[pos];

          if (enter_textoFijo == '<br/>') {
            vector_cadena_final[pos] = enter_textoFijo;
          }
          if (enter_textoFijo != '' && enter_textoFijo != null && enter_textoFijo != '<br/>') {
            enter_textoFijo = reemplazarCaracteresEspeciales(enter_textoFijo);
            vector_cadena_final[pos] = enter_textoFijo;

          }
        }

        INSTRUCTIONS = vector_cadena_final.join(' ');

      } catch (err) {
        libraryMail.sendemail(' [ formarInstrucciones ] ' + err, LMRY_script);
      }
    }

    function obtenerCodigoBarras(monto, nosso_number) {
      try {

        //Se obtiene la cadena para generar el código de barras
        var valorBoleto = 0;
        var codBanco = 0;
        var codMoneda = 0;
        var cobranza = '00';
        var codBenefCodBarras = 0;
        var nossoNumero = '';
        var digVerificador;
        var factorVencimiento;
        var cadena;
        var carteira = '0';

        codBanco = BANK_CODE.toString();
        valorBoleto = Number(monto).toFixed(2);
        valorBoleto = valorBoleto.replace(/\.| |\,/g, '');

        if (valorBoleto.length > 10) {
          valorBoleto = valorBoleto.substring(0, 10);
        } else {
          while (valorBoleto.length < 10) {
            valorBoleto = "0" + valorBoleto
          }
        }

        if (ID_CURRENCY != null && ID_CURRENCY != '') {
          codMoneda = ID_CURRENCY.toString();
        }

        if (duedate != null && duedate != null) {
          factorVencimiento = obtenerFactorVencimiento(duedate);
        }

        codBenefCodBarras = BENEFICIARY_CODE.replace(/\-|\.| |\,/g, '');

        if (codBenefCodBarras.length > 9) {
          var longitud = codBenefCodBarras.length;
          codBenefCodBarras = codBenefCodBarras.substring(longitud - 9, longitud);
        } else {
          while (codBenefCodBarras.length < 9) {
            codBenefCodBarras = "0" + codBenefCodBarras;
          }
        }

        if (COLLECTION_ACCOUNT != '') {
          var longitud = COLLECTION_ACCOUNT.length;

          cobranza = COLLECTION_ACCOUNT.substring(longitud - 2, longitud);
        }

        if (CARTERA != null && CARTERA != '') {
          carteira = CARTERA.substring(0, 1);
        }

        cadena = codBanco + codMoneda + factorVencimiento + valorBoleto + '3' + cobranza + carteira + codBenefCodBarras + nosso_number;
        digVerificador = calcularDVCodBarras(cadena);
        BARCODE = codBanco + codMoneda + digVerificador + factorVencimiento + valorBoleto + '3' + cobranza + carteira + codBenefCodBarras + nosso_number;

      } catch (err) {
        libraryMail.sendemail(' [ obtenerCodigoBarras ] ' + err, LMRY_script);
      }
    }

    function calcularDVCodBarras(cadena) {
      try {

        //Se calcula Dígito Verificador del Código de barras
        var digito = '';
        var digito_int = '';
        var vector = [];

        for (var i = cadena.length - 1; i >= 0; i--) {
          digito = cadena[i];
          digito_int = parseInt(digito);
          vector.push(digito_int);
        }

        var suma = 0;
        var digitoMultiplicado;
        var t = 2;

        for (var j = 0; j < vector.length; j++) {

          if (t <= 9) {
            digitoMultiplicado = vector[j] * t;
            t++;

          } else {
            t = 2;
            digitoMultiplicado = vector[j] * t;
            t++;
          }

          var suma = suma + digitoMultiplicado;
        }

        var resto = suma % 11;
        digitoVerificador = 11 - resto;

        if (resto == 0 || resto == 1) {
          digitoVerificador = 1;
        }

        return digitoVerificador;

      } catch (err) {
        libraryMail.sendemail(' [ calcularDVCodBarras ] ' + err, LMRY_script);
      }
    }

    //Linea digital: Representación Numérica del Codigo de Barras
    function obtenerLineaDigital() {
      try {
        var digVerificador1 = '';
        var digVerificador2 = '';
        var digVerificador3 = '';

        var campo1 = BARCODE.substring(0, 4); //7459
        var campo2 = BARCODE.substring(4, 5); //Digito Verificador del codigo de Barras
        var campo3 = BARCODE.substring(5, 19); //FactorVencimiento(4 digitos) + valorTitulo(10 digitos)
        var campo4 = BARCODE.substring(19, 24); // Campo fijo '3' + Portfolio (3 dígitos) + Codigo Beneficiario (primer dígito)
        var campo5 = BARCODE.substring(24, 34); // Codigo beneficiario (8 últimos dígitos)+ Nosso Numero (primeros 2 dígitos)
        var campo6 = BARCODE.substring(34, 44); // Nosso Número (10 dígitos restantes)

        var campo_1_4 = campo1 + campo4;
        digVerificador1 = obtenerDigitoVerificadorLD(campo_1_4);
        digVerificador2 = obtenerDigitoVerificadorLD(campo5);
        digVerificador3 = obtenerDigitoVerificadorLD(campo6);

        var dig1_campo4 = campo4.substring(0, 1);
        var dig2_campo4 = campo4.substring(1, 5);
        var nuevo_campo4 = dig1_campo4 + "." + dig2_campo4;

        var dig1_campo5 = campo5.substring(0, 5);
        var dig2_campo5 = campo5.substring(5, 10);
        var nuevo_campo5 = dig1_campo5 + "." + dig2_campo5;

        var dig1_campo6 = campo6.substring(0, 5);
        var dig2_campo6 = campo6.substring(5, 10);
        var nuevo_campo6 = dig1_campo6 + "." + dig2_campo6;

        DIGITAL_LINE = campo1 + nuevo_campo4 + digVerificador1 + " " + nuevo_campo5 + digVerificador2 + " " + nuevo_campo6 + digVerificador3 + " " + campo2 + " " + campo3;

      } catch (err) {
        libraryMail.sendemail(' [ obtenerLineaDigital ] ' + err, LMRY_script);
      }
    }

    function obtenerDigitoVerificadorLD(campo) {
      try {
        var digVerificador = '';
        var vector = [];
        var digMulti;
        var suma = 0;

        for (var i = campo.length - 1; i >= 0; i--) {
          digito = campo[i];
          digito_int = parseInt(digito);
          vector.push(digito_int);
        }

        for (var j = 0; j < vector.length; j++) {

          if (j % 2 == 0) {
            digMulti = vector[j] * 2;
            digMulti = obtenerSumaDigitosNumero(digMulti);
          } else {
            digMulti = vector[j] * 1;
            digMulti = obtenerSumaDigitosNumero(digMulti);

          }
          suma = suma + digMulti;

        }
        var resto = suma % 10;

        digVerificador = 10 - resto;
        if (digVerificador == 10) {
          digVerificador = 0;
        }

        return digVerificador;

      } catch (err) {
        libraryMail.sendemail(' [ obtenerDigitoVerificadorLD ] ' + err, LMRY_script);
      }
    }

    function obtenerSumaDigitosNumero(numero) {

      try {
        var suma = 0;
        var numeroString = numero.toString();

        for (var i = 0; i < numeroString.length; i++) {
          var digito = numeroString[i];
          digito_int = parseInt(digito);
          suma = suma + digito_int;
        }
        return suma;

      } catch (err) {
        libraryMail.sendemail(' [ reemplazarCaracteresEspeciales ] ' + err, LMRY_script);
      }

    }

    function obtenerEspecieDOC() {
      try {

        //Busqueda en el record "LatamReady - BR Transaction Fields" para obtener Document Specie
        var searchBRTransactionFields = search.create({
          type: 'customrecord_lmry_br_transaction_fields',
          columns: ['custrecord_lmry_br_document_specie.custrecord_lmry_br_docu_specie_siglas','custrecord_lmry_br_sacador_avalista'],
          filters: ['custrecord_lmry_br_related_transaction', 'is', ID_INV]
        });

        var searchResult = searchBRTransactionFields.run().getRange(0, 1);
        if (searchResult != '' && searchResult != null && searchResult.length > 0) {
          var columns = searchResult[0].columns;
          var siglas_documentoEspecie = searchResult[0].getValue(columns[0]);
          ID_SACADOR_AVALISTA = searchResult[0].getValue(columns[1]);
          if (siglas_documentoEspecie != null && siglas_documentoEspecie != '') {
            DOCUMENT_SPECIE = siglas_documentoEspecie;
          }
        }

      } catch (err) {
        libraryMail.sendemail(' [ reemplazarCaracteresEspeciales ] ' + err, LMRY_script);
      }
    }

    function reciboPagador(monto, nossoNumber) {
      try {
        var html = "";

        html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%;align:center;margin-top:5px\">";
        html += "<tr>";
        html += "<td style = \"border-bottom:0.8px dashed\" colspan=\"7\"> </td>";
        html += "</tr>";
        html += "</table>";

        html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%; align:center;border-bottom:1.0px;padding-top:0px\" >";
        html += "<tr>";
        html += "<td valign=\"bottom\" align=\"left\" colspan=\"1\" width=\"25%\" style=\"padding-left:0px;padding-bottom: 4px;padding-right:0px \"><img  src=\"" + xml.escape(URL_LOGO) + "\" width=\"120\" height=\"20\"/></td>";
        html += "<td valign=\"bottom\"  colspan=\"1\" width=\"10%\">  <p style=\"border-left:1px; border-right:1px;  padding-bottom: -2px; padding-left:12px ;padding-right:12px; padding-top:9px\">  <b> " + BANK_CODE + "-" + DV_CODE + "</b> </p></td>";
        html += "<td valign=\"bottom\"  align=\"right\" colspan=\"5\" width=\"65%\"> <p style=\"padding-bottom: -2px;font-size: 11.5pt\"> <b>Recibo do Sacado/Pagador</b> </p></td>";
        html += "</tr>";
        html += "</table>";

        html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; align:center; width:100%;height:95mm\">";

        html += "<tr>";
        html += "<td style=\"font-size: 6.8pt\" colspan=\"1\">Local de Pagamento</td>";
        html += "<td colspan=\"4\" align=\"left\"> </td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px;padding-left:50px; padding-top:50px\" colspan=\"2\" rowspan=\"9\"><img  src=\"" + xml.escape(URL_LOGO) + "\" width=\"60\" height=\"20\"/></td>";
        html += "</tr>";
        html += "<tr>";
        html += "<td style=\"font-size: 7pt; border-bottom:1px\" colspan=\"5\" align=\"left\">" + reemplazarCaracteresEspeciales(PLACE_PAYMENT) + "</td>";
        html += "</tr>"

        html += "<tr>";
        html += "<td style=\"font-size:6.7pt\" colspan=\"5\" align=\"left\">Beneficiário</td>";
        html += "</tr>";

        html += "<tr>";
        html += "<td style=\"font-size: 7pt\" align=\"left\" colspan=\"5\">" + NAME_SUBSIDIARY + CNPJ_SUBSIDIARY + "</td>";
        html += "</tr>";

        html += "<tr>";
        html += "<td style=\"font-size: 7pt; border-top:-5px; border-bottom:1px\" align=\"left\" colspan=\"5\">" + ADDRESS_SUBSIDIARY + "</td>";
        html += "</tr>";

        html += "<tr>";
        html += "<td style=\"font-size: 6.8pt\" colspan=\"1\" >Data do documento</td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px \" colspan=\"1\" >Nº do documento</td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px \" colspan=\"1\" >Espécie DOC.</td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px\" colspan=\"1\" >Aceite</td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px\" colspan=\"1\" >Data Processamento</td>";
        html += "</tr>";
        html += "<tr >";
        html += "<td style=\"font-size: 7pt; border-bottom:1px\" align=\"left\" colspan=\"1\">" + DATE_INV + "</td>";
        html += "<td style=\"font-size: 7pt; border-left:1px; border-bottom:1px\" align=\"left\" colspan=\"1\">" + NRO_DOCUMENT + "</td>";
        html += "<td style=\"font-size: 7pt; border-left:1px; border-bottom:1px\" align=\"left\" colspan=\"1\">" + DOCUMENT_SPECIE + "</td>";
        html += "<td style=\"font-size: 7pt; border-left:1px; border-bottom:1px\" align=\"left\" colspan=\"1\">" + ACCEPTANCE + "</td>";
        html += "<td style=\"font-size: 7pt; border-left:1px; border-bottom:1px\" align=\"left\" colspan=\"1\">" + DATE_INV + "</td>";
        html += "</tr>";

        html += "<tr>";
        html += "<td style=\"font-size: 6.8pt\" colspan=\"1\" >Uso do Banco </td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px \" colspan=\"1\" >Carteira </td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px \" colspan=\"1\" >Espécie</td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px\" colspan=\"1\" >Quantidade</td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px\" colspan=\"1\" >xValor</td>";
        html += "</tr>";
        html += "<tr style=\"border-bottom:1px \">";
        html += "<td style=\"font-size: 7pt\" align=\"left\" colspan=\"1\">CLIENTE RCO</td>";
        html += "<td style=\"font-size: 7pt; border-left:1px\" align=\"left\" colspan=\"1\">" + CARTERA + "</td>";
        html += "<td style=\"font-size: 7pt; border-left:1px\" align=\"left\" colspan=\"1\">" + CURRENCY_SYMBOL + "</td>";
        html += "<td style=\"font-size: 7pt; border-left:1px\" align=\"left\" colspan=\"1\"></td>";
        html += "<td style=\"font-size: 7pt; border-left:1px\" align=\"left\" colspan=\"1\"></td>";
        html += "</tr>";

        html += "<tr >";
        html += "<td style=\"font-size:6.8pt\" colspan=\"5\" rowspan=\"14\"> <p style=\"font-size:6.8pt\" >Informações de responsabilidade do beneficiário</p> <p style=\"font-size:7pt; \"> " + INSTRUCTIONS + "</p>  </td>";
        html += "<td style=\"font-size:6.8pt; border-left:1px\" colspan=\"2\">Vencimento </td>";
        html += "</tr>";
        html += "<tr>";
        html += "<td style=\"font-size: 7pt; border-left: 1px; border-bottom:1px; min-height:16px\" align=\"right\" colspan=\"2\" >" + DATE_VENC + "</td>";
        html += "</tr>";
        html += "<tr >";
        html += "<td style=\"font-size:6.8pt;border-left:1px\" colspan=\"2\">Agência/Código do Beneficiário</td>";
        html += "</tr>";
        html += "<tr>";
        html += "<td style=\"font-size: 7pt; border-left: 1px; border-bottom:1px; min-height:16px\" align=\"right\" colspan=\"2\" >" + AGENCY_BENEFICIARY_CODE + "</td>";
        html += "</tr>";
        html += "<tr >";
        html += "<td style=\"font-size:6.8pt;border-left:1px\" colspan=\"2\">Nosso Número</td>";
        html += "</tr>";
        html += "<tr>";
        html += "<td style=\"font-size: 7pt; border-left: 1px; border-bottom:1px; min-height:16px\" align=\"right\" colspan=\"2\" > " + nossoNumber + "</td>";
        html += "</tr>";
        html += "<tr >";
        html += "<td style=\"font-size:6.8pt;border-left:1px\" colspan=\"2\">(=) Valor documento</td>";
        html += "</tr>";
        html += "<tr>";
        html += "<td style=\"font-size: 7pt; border-left: 1px; border-bottom:1px; min-height:16px\" align=\"right\" colspan=\"2\" >" + monto + "</td>";
        html += "</tr>";
        html += "<tr >";
        html += "<td style=\"font-size:6.8pt;border-left:1px\" colspan=\"2\">(-) Valor desconto </td>";
        html += "</tr>";
        html += "<tr>";
        html += "<td style=\"font-size: 7pt; border-left: 1px; border-bottom:1px; min-height:16px\" align=\"left\" colspan=\"2\" >  </td>";
        html += "</tr>";
        html += "<tr >";
        html += "<td style=\"font-size:6.8pt;border-left:1px\" colspan=\"2\">(-) Outros deduções/ Abatimentos</td>";
        html += "</tr>";
        html += "<tr>";
        html += "<td style=\"font-size: 7pt; border-left: 1px; border-bottom:1px; min-height:16px\" align=\"left\" colspan=\"2\" >  </td>";
        html += "</tr>";

        html += "<tr >";
        html += "<td style=\"font-size:6.8pt; border-left:1px\" colspan=\"2\">(=) Valor Cobrado</td>";
        html += "</tr>";
        html += "<tr style=\"border-bottom:1px \" >";
        html += "<td style=\"font-size: 7pt; min-height:16px; border-left:1px;\" align=\"left\" colspan=\"2\" ></td>";
        html += "</tr>";

        html += "<tr>";
        html += "<td style=\"font-size:6.8pt\" colspan=\"1\" align=\"left\"><b>Pagador</b></td>";
        html += "<td style=\"font-size:6.8pt\" colspan=\"6\" align=\"left\">" + NAME_CUSTOMER + CNPJ_CUSTOMER + "</td>";
        html += "</tr>";

        html += "<tr>";
        html += "<td style=\"font-size:7pt; border-top:-5px;\" colspan=\"7\" align=\"left\">" + ADDRESS_CUSTOMER1 + "</td>";
        html += "</tr>";

        html += "<tr>";
        html += "<td style=\"font-size:7pt; border-top:-5px;\" colspan=\"7\" align=\"left\">" + ADDRESS_CUSTOMER2 + "</td>";
        html += "</tr>";

        html += "<tr style=\"border-bottom:1px\">";
        html += "<td style=\"font-size:6.8pt\" colspan=\"1\" align=\"left\"><b>Sacador/Avalista</b></td>";
        html += "<td style=\"font-size:7pt\" colspan=\"6\" align=\"left\">" + NAME_SACADOR + CNPJ_SACADOR + '  ' + ADDRESS_SACADOR + "</td>";
        html += "</tr>";

        html += "</table>";

        html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%;align:center\">";
        html += "<tr>";
        html += "<td style=\"font-size: 5.8pt;padding-top:0px;padding-bottom:15px;padding-right:0px\" align=\"right\">Autenticação mecânica</td>";
        html += "</tr>";
        html += "<tr>";
        html += "</tr>";
        html += "</table>";
        return html;

      } catch (err) {
        libraryMail.sendemail(' [ reciboPagador ] ' + err, LMRY_script);
      }

    }

    function fichaCompensacion(monto, nossoNumber) {
      try {

        var html = "";
        html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%;align:center;margin-top:5px\">";
        html += "<tr>";
        html += "<td style = \"border-bottom:0.8px dashed\" colspan=\"7\"> </td>";
        html += "</tr>";
        html += "</table>";

        html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%; align:center;border-bottom:1.0px;padding-top:0px\" >";
        html += "<tr>";
        html += "<td valign=\"bottom\" align=\"left\" colspan=\"1\" width=\"25%\" style=\"padding-left:0px;padding-bottom: 4px;padding-right:0px \"><img  src=\"" + xml.escape(URL_LOGO) + "\" width=\"120\" height=\"20\"/></td>";
        html += "<td valign=\"bottom\"  colspan=\"1\" width=\"10%\">  <p style=\"border-left:1px; border-right:1px;  padding-bottom: -2px; padding-left:12px ;padding-right:12px; padding-top:9px\">  <b> " + BANK_CODE + "-" + DV_CODE + "</b> </p></td>";
        html += "<td valign=\"bottom\"  align=\"right\" colspan=\"5\" width=\"65%\"> <p style=\"padding-bottom: -2px;font-size: 11.5pt\"> <b>" + DIGITAL_LINE + " </b> </p></td>";
        html += "</tr>";
        html += "</table>";

        html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; align:center; width:100%;height:95mm\">";

        html += "<tr>";
        html += "<td style=\"font-size: 6.8pt\" colspan=\"1\">Local de Pagamento</td>";
        html += "<td colspan=\"4\" align=\"left\"> </td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px\" colspan=\"2\">Vencimento</td>";
        html += "</tr>";
        html += "<tr style=\"border-bottom:1px\">";
        html += "<td style=\"font-size: 7pt\" colspan=\"5\" align=\"left\">" + reemplazarCaracteresEspeciales(PLACE_PAYMENT) + "</td>";
        html += "<td style=\"font-size: 7pt; border-left:1px\" colspan=\"2\" align=\"right\">" + DATE_VENC + "</td>";
        html += "</tr>"

        html += "<tr>";
        html += "<td style=\"font-size:6.8pt\" colspan=\"5\" align=\"left\">Beneficiário</td>";
        html += "<td style=\"font-size:6.8pt; border-left:1px\" colspan=\"2\" align=\"left\">Agência/Código do Beneficiário</td>";
        html += "</tr>";

        html += "<tr>";
        html += "<td style=\"font-size: 7pt\" align=\"left\" colspan=\"5\">" + NAME_SUBSIDIARY + CNPJ_SUBSIDIARY + "</td>";
        html += "<td style=\"font-size: 7pt;border-left:1px\" colspan=\"2\"  align=\"right\"></td>";
        html += "</tr>";

        html += "<tr style=\"border-bottom:1px\">";
        html += "<td style=\"font-size: 7pt; border-top:-5px\" align=\"left\" colspan=\"5\">" + ADDRESS_SUBSIDIARY + "</td>";
        html += "<td style=\"font-size: 7pt;border-left:1px; border-top:-5px\" colspan=\"2\"  align=\"right\">" + AGENCY_BENEFICIARY_CODE + "</td>";
        html += "</tr>";

        html += "<tr>";
        html += "<td style=\"font-size: 6.8pt\" colspan=\"1\" >Data do documento</td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px \" colspan=\"1\" >Nº do documento</td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px \" colspan=\"1\" >Espécie DOC.</td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px\" colspan=\"1\" >Aceite</td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px\" colspan=\"1\" >Data Processamento</td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px\" colspan=\"2\" >Nosso Número</td>";
        html += "</tr>";
        html += "<tr style=\"border-bottom:1px\">";
        html += "<td style=\"font-size: 7pt\" align=\"left\" colspan=\"1\">" + DATE_INV + "</td>";
        html += "<td style=\"font-size: 7pt; border-left:1px\" align=\"left\" colspan=\"1\">" + NRO_DOCUMENT + "</td>";
        html += "<td style=\"font-size: 7pt; border-left:1px\" align=\"left\" colspan=\"1\">" + DOCUMENT_SPECIE + "</td>";
        html += "<td style=\"font-size: 7pt; border-left:1px\" align=\"left\" colspan=\"1\">" + ACCEPTANCE + "</td>";
        html += "<td style=\"font-size: 7pt; border-left:1px\" align=\"left\" colspan=\"1\">" + DATE_INV + "</td>";
        html += "<td style=\"font-size: 7pt; border-left:1px\" align=\"right\" colspan=\"2\">" + nossoNumber + "</td>";
        html += "</tr>";

        html += "<tr>";
        html += "<td style=\"font-size: 6.8pt\" colspan=\"1\" >Uso do Banco </td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px \" colspan=\"1\" >Carteira </td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px \" colspan=\"1\" >Espécie</td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px\" colspan=\"1\" >Quantidade</td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px\" colspan=\"1\" >xValor</td>";
        html += "<td style=\"font-size: 6.8pt; border-left:1px\" colspan=\"2\" >(=) Valor do documento</td>";
        html += "</tr>";
        html += "<tr style=\"border-bottom:1px \">";
        html += "<td style=\"font-size: 7pt\" align=\"left\" colspan=\"1\">CLIENTE RCO</td>";
        html += "<td style=\"font-size: 7pt; border-left:1px\" align=\"left\" colspan=\"1\">" + CARTERA + "</td>";
        html += "<td style=\"font-size: 7pt; border-left:1px\" align=\"left\" colspan=\"1\">" + CURRENCY_SYMBOL + "</td>";
        html += "<td style=\"font-size: 7pt; border-left:1px\" align=\"left\" colspan=\"1\"></td>";
        html += "<td style=\"font-size: 7pt; border-left:1px\" align=\"left\" colspan=\"1\"></td>";
        html += "<td style=\"font-size: 7pt; border-left:1px\" align=\"right\" colspan=\"2\">" + monto + "</td>";
        html += "</tr>";

        html += "<tr >";
        html += "<td style=\"font-size:6.8pt\" colspan=\"5\" rowspan=\"6\"> <p style=\"font-size:6.8pt\" >Informações de responsabilidade do beneficiário</p> <p style=\"font-size:7pt; \"> " + INSTRUCTIONS + "</p>  </td>";
        html += "<td style=\"font-size:6.8pt; border-left:1px\" colspan=\"2\">(-) Valor desconto </td>";
        html += "</tr>";
        html += "<tr>";
        html += "<td style=\"font-size: 7pt; border-left: 1px; border-bottom:1px; min-height:16px\" align=\"left\" colspan=\"2\" ></td>";
        html += "</tr>";
        html += "<tr >";
        html += "<td style=\"font-size:6.8pt;border-left:1px\" colspan=\"2\">(-) Outros deduções/ Abatimentos</td>";
        html += "</tr>";
        html += "<tr>";
        html += "<td style=\"font-size: 7pt; border-left: 1px; border-bottom:1px; min-height:16px\" align=\"left\" colspan=\"2\" ></td>";
        html += "</tr>";
        html += "<tr >";
        html += "<td style=\"font-size:6.8pt; border-left:1px\" colspan=\"2\">(=) Valor Cobrado</td>";
        html += "</tr>";
        html += "<tr style=\"border-bottom:1px \" >";
        html += "<td style=\"font-size: 7pt; min-height:16px; border-left:1px;\" align=\"left\" colspan=\"2\" ></td>";
        html += "</tr>";

        html += "<tr>";
        html += "<td style=\"font-size:6.8pt\" colspan=\"1\" align=\"left\"><b>Pagador</b></td>";
        html += "</tr>";

        html += "<tr>";
        html += "<td style=\"font-size:7pt\" colspan=\"7\" align=\"left\">" + NAME_CUSTOMER + CNPJ_CUSTOMER + "</td>";
        html += "</tr>";

        html += "<tr>";
        html += "<td style=\"font-size:7pt; border-top:-3px;\" colspan=\"7\" align=\"left\">" + ADDRESS_CUSTOMER1 + "</td>";
        html += "</tr>";

        html += "<tr>";
        html += "<td style=\"font-size:7pt; border-top:-5px;\" colspan=\"7\" align=\"left\">" + ADDRESS_CUSTOMER2 + "</td>";
        html += "</tr>";

        html += "<tr style=\"border-bottom:1px\">";
        html += "<td style=\"font-size:6.8pt\" colspan=\"1\" align=\"left\"><b>Sacador/Avalista</b></td>";
        html += "<td style=\"font-size:7pt\" colspan=\"6\" align=\"left\">" + NAME_SACADOR + CNPJ_SACADOR + '  ' + ADDRESS_SACADOR + "</td>";
        html += "</tr>";

        html += "</table>";

        html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%;align:center\">";
        html += "<tr>";
        html += "<td style=\"font-size: 5.8pt;padding-top:0px;padding-bottom:15px;padding-right:0px\" align=\"right\">Autenticação mecânica</td>";
        html += "</tr>";
        html += "<tr>";
        html += "</tr>";
        html += "</table>";

        //codigo de barras
        html += "<table style=\"font-family: Verdana, Arial, Helvetica, sans-serif; width:100%; align:left;\">";
        html += "<tr>";
        html += "<td valign=\"middle\" align=\"left\"> <barcode codetype=\"code128\" showtext=\"false\" value=\"" + BARCODE + "\" width=\"103mm\" height=\"13mm\"/> </td>";
        html += "</tr>";
        html += "</table>";

        return html;
      } catch (err) {
        libraryMail.sendemail(' [ fichaCompensacion ] ' + err, LMRY_script);
      }

    }

    function obtenerFactorVencimiento(dataVencimiento) {
      try {

        //Cálculo de Factor de Vencimiento para generación de Código de Barras
        var diferenciaDias = '';
        var fechaBase = new Date('1997/10/07'); //Fecha Base (año mes dia)

        var fechaVencimiento = format.parse({
          value: dataVencimiento,
          type: format.Type.DATE
        });

        var resta = fechaVencimiento.getTime() - fechaBase.getTime();
        diferenciaDias = Math.round(resta / (1000 * 60 * 60 * 24));

        while (diferenciaDias > 9999) {
          diferenciaDias = diferenciaDias - 9000;
        }

        var diferenciaDiasString = diferenciaDias.toString();
        while (diferenciaDiasString.length < 4) {
          diferenciaDiasString = "0" + diferenciaDiasString
        }

        return diferenciaDiasString;

      } catch (err) {
        libraryMail.sendemail(' [ obtenerFactorVencimiento ] ' + err, LMRY_script);
      }
    }

    function reemplazarCaracteresEspeciales(cadena) {
      try {
        cadena = cadena.replace(/&gt;/g, '>');
        cadena = cadena.replace(/&lt;/g, '<');
        cadena = xml.escape(cadena);

        return cadena;

      } catch (err) {
        libraryMail.sendemail(' [ reemplazarCaracteresEspeciales ] ' + err, LMRY_script);
      }
    }

    function formatoFecha(fecha) {
      try {
        var formatoFecha = '';

        fecha = format.parse({
          value: fecha,
          type: format.Type.DATE
        });

        var day = fecha.getDate();
        day = day.toString();
        if (day.length == 1) {
          day = '0' + day
        }

        var month = fecha.getMonth() + 1;
        month = month.toString();
        if (month.length == 1) {
          month = '0' + month
        }

        var year = fecha.getFullYear();

        formatoFecha = day + '/' + month + '/' + year;
        return formatoFecha;

      } catch (err) {
        libraryMail.sendemail(' [ formatoFecha ] ' + err, LMRY_script);
      }
    }

    function search_folder() {
      try {

        // Ruta de la carpeta contenedora
        var FolderId = runtime.getCurrentScript().getParameter({
          name: 'custscript_lmry_br_boleto_bancario'
        });


        if (FolderId == '' || FolderId == null) {
          // Valida si existe "SuiteLatamReady" en File Cabinet
          var varIdFolderPrimary = '';

          var ResultSet = search.create({
            type: 'folder',
            columns: ['internalid'],
            filters: ['name', 'is', 'SuiteLatamReady']
          });

          objResult = ResultSet.run().getRange(0, 50);

          if (objResult == '' || objResult == null) {
            var varRecordFolder = record.create({
              type: 'folder'
            });
            varRecordFolder.setValue('name', 'SuiteLatamReady');
            varIdFolderPrimary = varRecordFolder.save();
          } else {
            varIdFolderPrimary = objResult[0].getValue('internalid');
          }

          // Valida si existe "Latam BR - PDF Boleto Bancario" en File Cabinet
          var varFolderId = '';
          var ResultSet = search.create({
            type: 'folder',
            columns: ['internalid'],
            filters: [
              ['name', 'is', 'Latam BR - PDF Boleto Bancario']
            ]
          });
          objResult = ResultSet.run().getRange(0, 50);

          if (objResult == '' || objResult == null) {
            var varRecordFolder = record.create({
              type: 'folder'
            });
            varRecordFolder.setValue('name', 'Latam BR - PDF Boleto Bancario');
            varRecordFolder.setValue('parent', varIdFolderPrimary);
            varFolderId = varRecordFolder.save();
          } else {
            varFolderId = objResult[0].getValue('internalid');
          }


          // Load the NetSuite Company Preferences page
          var varCompanyReference = config.load({
            type: config.Type.COMPANY_PREFERENCES
          });

          // set field values
          varCompanyReference.setValue({
            fieldId: 'custscript_lmry_br_boleto_bancario',
            value: varFolderId
          });
          // save changes to the Company Preferences page
          varCompanyReference.save();
        }

      } catch (err) {
        libraryMail.sendemail(' [ search_folder ] ' + err, LMRY_script);
      }
    }

    return {
      obtenerURLPDFBoletoBancario: obtenerURLPDFBoletoBancario
    };

  });
