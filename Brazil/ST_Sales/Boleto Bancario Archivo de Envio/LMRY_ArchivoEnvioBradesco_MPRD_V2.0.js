/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                    ||
||                                                             ||
||  File Name: LMRY_ArchivoEnvioBradesco_MPRD_V2.0.js          ||
||                                                             ||
||  Version Date         Author        Remarks                 ||
||  1.0     Ago 26 2019  LatamReady    Use Script 2.0          ||
\= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */

define(['N/log', 'N/record', 'N/search', 'N/format', 'N/runtime', 'N/email', 'N/config', 'N/file', './Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],
  function (log, record, search, format, runtime, email, config, file, libraryMail) {

    //Datos de la Configuracion (Subsidiaria - Banco Santander)
    var codigoBeneficiario = '';
    var codigoBeneficiarioTotal = '';
    var agenciaTotal = '';
    var dvCodigoBenef = '';
    var codigoCartera = '';
    var codigoBanco = '';
    var aceptacion = '';
    var cuentaCobro = '';
    var agencia = '';
    var dvAgencia = '';
    var correlative_file = '';
    var configbank_id = '';
    var numConvenioCobranza = ''; //Configurar en Config Bank Ticket

    var file_name = '';
    var formatoFechaNameFile = '';


    //Datos de la Subsidiaria/Beneficiario
    var nombreSubsidiaria = '';
    var cnpjSubsidiaria = '';

    //Datos del Customer/Pagador
    var nomCustomer = '';
    var cnpjCustomer = '';
    var addressCustomer = '';
    var tipoCustomer = '';
    var bairroCustomer = '';
    var cepCustomer = '';
    var ciudadCustomer = '';
    var ufCustomer = '';

    //Datos del Invoice
    var dateInvoice = '';
    var dueDateInvoice = '';
    var montoTotalInvoice = '';
    var numPreImpreso = '';

    var complementoRegistro = '';
    var nossoNumero = '';
    var codigoEspecieDoc = '';
    var nombreBanco = 'BRADESCO';
    var numConvenioLider = '';
    var codControlEmpresa = '';
    var variacionCartera = ''; //Configurar en Config Bank Ticket

    // FEATURE SUITETAX
    var ST_FEATURE = false;


    var LMRY_script = 'LatamReady - Archivo de Envio Banco Bradesco MPRD';

    function getInputData() {
      try {
        //Crea la carpeta si no existe
        search_folder();

        ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var id_record_log = runtime.getCurrentScript().getParameter({ name: 'custscript_lmry_brd_record_log' });

        var record_br_log_shipping_file = search.lookupFields({
          type: 'customrecord_lmry_br_log_shipping_file',
          id: id_record_log,
          columns: ['custrecord_lmry_br_log_subsidiary', 'custrecord_lmry_br_log_bank', 'custrecord_lmry_br_log_date_from', 'custrecord_lmry_br_log_date_to']
        });

        var subsidiaria = record_br_log_shipping_file.custrecord_lmry_br_log_subsidiary[0].value;

        var bank = record_br_log_shipping_file.custrecord_lmry_br_log_bank[0].value;

        var fecha_desde = record_br_log_shipping_file.custrecord_lmry_br_log_date_from;

        var fecha_hasta = record_br_log_shipping_file.custrecord_lmry_br_log_date_to;

        var columns = [
          'trandate', 'subsidiary',
          'custrecord_lmry_br_related_transaction.custrecord_lmry_br_pdf_bank',
          'custrecord_lmry_br_related_transaction.custrecord_lmry_br_document_specie',
          'custrecord_lmry_br_related_transaction.custrecord_lmry_br_nosso_numero',
          'custrecord_lmry_br_related_transaction.custrecord_lmry_br_bb_status',
          'custrecord_lmry_br_related_transaction.custrecord_lmry_br_processing_date',
          "custrecord_lmry_br_related_transaction.custrecord_lmry_br_send_multa",
          "custrecord_lmry_br_related_transaction.custrecord_lmry_br_send_interes"
        ];

        var licenses = libraryMail.getLicenses(subsidiaria);

        var FEAT_INSTALLMENTS = runtime.isFeatureInEffect({ feature: "installments" });
        if (libraryMail.getAuthorization(536, licenses) && (FEAT_INSTALLMENTS == "T" || FEAT_INSTALLMENTS == true)) {
          columns.push("installment.installmentnumber");
        }

        return search.create({
          type: 'invoice',
          columns: columns,
          filters: [
            ["mainline", "is", "T"],
            "AND", ["subsidiary", "is", subsidiaria],
            "AND", ["trandate", "within", fecha_desde, fecha_hasta],
            "AND", ["custrecord_lmry_br_related_transaction.custrecord_lmry_br_pdf_bank", "anyof", bank],
            "AND", ["status", "anyof", "CustInvc:A"]
          ]
        });

      } catch (error) {
        log.error('ERROR', '[ getInputData ]');
        libraryMail.sendemail(' [ getInputData ] ' + error, LMRY_script);
        return true;
      }
    }

    function map(context) {
      try {

        var searchResult = JSON.parse(context.value);
        var invoiceID = searchResult.id;
        var trandate = searchResult.values.trandate;
        var id_subsidiary = searchResult.values.subsidiary.value;
        var pdfBank = searchResult.values['custrecord_lmry_br_pdf_bank.custrecord_lmry_br_related_transaction'].value;
        var documentEspecie = searchResult.values['custrecord_lmry_br_document_specie.custrecord_lmry_br_related_transaction'].value;
        var nossoNumber = searchResult.values['custrecord_lmry_br_nosso_numero.custrecord_lmry_br_related_transaction'];
        var status = searchResult.values['custrecord_lmry_br_bb_status.custrecord_lmry_br_related_transaction'].value;
        var processingDate = searchResult.values['custrecord_lmry_br_processing_date.custrecord_lmry_br_related_transaction'];
        var multa = searchResult.values["custrecord_lmry_br_send_multa.custrecord_lmry_br_related_transaction"] || 0.00;
        multa = parseFloat(multa);
        var moraPorDia = searchResult.values["custrecord_lmry_br_send_interes.custrecord_lmry_br_related_transaction"] || 0.00;
        moraPorDia = parseFloat(moraPorDia);

        var installmentNumber = "";
        var licenses = libraryMail.getLicenses(id_subsidiary);
        var FEAT_INSTALLMENTS = runtime.isFeatureInEffect({ feature: "installments" });
        var useInstallments = libraryMail.getAuthorization(536, licenses) && (FEAT_INSTALLMENTS == "T" || FEAT_INSTALLMENTS == true);
        if (useInstallments) {
          installmentNumber = searchResult.values["installmentnumber.installment"];
        }

        obtenerDatosSubsidiaria(id_subsidiary);
        obtenerDatosConfigSubsidiariaBancoBradesco(id_subsidiary, pdfBank);

        context.write({
          key: trandate,
          value: obtenerDetalleRegistroObli(invoiceID, installmentNumber, documentEspecie, nossoNumber, status, processingDate, multa, moraPorDia) //+''+invoiceID;//secuencia temporal
        });
      } catch (error) {
        log.error("error", "[invoiceID, installmentNumber, trandate]", [invoiceID, installmentNumber, trandate].join("-"));
        log.error("error", error);

        context.write({
          key: 0,
          value: invoiceID
        });
      }

    }

    function summarize(context) {
      var array_file = {};
      var id_file_array = [];
      context.output.iterator().each(function (key, value) {

        if (array_file[key]) {
          array_file[key].push(value);
        } else {
          array_file[key] = [value];
        }

        return true;
      });


      try {

        if (array_file.length == 0)
          throw 'There is not content.';

        // Ruta de la carpeta contenedora
        var id_folder = runtime.getCurrentScript().getParameter({ name: 'custscript_lmry_br_arquivo_remessa' });

        var id_record_log = runtime.getCurrentScript().getParameter({ name: 'custscript_lmry_brd_record_log' });

        //******* Fecha creacion del Archivo de Envío *******
        var fechaDeCreacionArchivo = new Date();
        var horas = fechaDeCreacionArchivo.getHours();
        horas = completarInicio(horas, 2, '0');
        var minutos = fechaDeCreacionArchivo.getMinutes();
        minutos = completarInicio(minutos, 2, '0');
        var segundos = fechaDeCreacionArchivo.getSeconds();
        segundos = completarInicio(segundos, 2, '0');
        //***************************************************

        //Se obtienen los campos necesarios para generar Cabecera de Archivo
        var record_br_log_shipping_file = search.lookupFields({
          type: 'customrecord_lmry_br_log_shipping_file',
          id: id_record_log,
          columns: ['custrecord_lmry_br_log_subsidiary', 'custrecord_lmry_br_log_bank']
        });
        var id_subsidiary = record_br_log_shipping_file.custrecord_lmry_br_log_subsidiary[0].value;

        var pdf_bank = record_br_log_shipping_file.custrecord_lmry_br_log_bank[0].value;
        var cabecera = obtenerCabeceraArchivo(id_subsidiary, pdf_bank);

        for (var fecha in array_file) {
          formatoFecha(fecha);
          var cadena = cabecera;
          cadena += cabeceraCorrelativo();
          var i;
          for (i = 0; i < array_file[fecha].length; i++) {
            cadena += concatenarSecuencia(array_file[fecha][i], i + 2);
          }
          cadena += '\n';
          cadena += obtenerTrailerArchivo(i + 2);

          cadena = ValidarCaracteres_Especiales(cadena);


          var fileRemesa = file.create({
            name: 'BRDCollection' + file_name + '-' + formatoFechaNameFile + '-' + horas + minutos + segundos + '.rem',
            fileType: file.Type.PLAINTEXT,
            contents: cadena,
            folder: id_folder
          });
          var id_file = fileRemesa.save();
          id_file_array.push(id_file);

          record.submitFields({
            type: 'customrecord_lmry_br_config_bank_ticket',
            id: configbank_id,
            values: {
              'custrecord_lmry_shipping_sequential': correlative_file,
            },
            option: {
              disableTriggers: true // con esto se evita que se bloquee el record, osea que no funciones los userevent
            }
          });

        }

        record.submitFields({
          type: 'customrecord_lmry_br_log_shipping_file',
          id: id_record_log,
          values: {
            custrecord_lmry_br_log_idfile: id_file_array.join('|'),
            custrecord_lmry_br_log_state: 'Finalized'
          },
          option: {
            disableTriggers: true // con esto se evita que se bloquee el record, osea que no funciones los userevent
          }
        });

      } catch (error) {
        var id_record_log = runtime.getCurrentScript().getParameter({
          name: 'custscript_lmry_brd_record_log'
        });
        //Cambiando el estado al registro  "LatamReady - BR Shipping File" - ERROR

        record.submitFields({
          type: 'customrecord_lmry_br_log_shipping_file',
          id: id_record_log,
          values: {
            custrecord_lmry_br_log_state: 'Error'
          },
          option: {
            disableTriggers: true // con esto se evita que se bloquee el record, osea que no funciones los userevent
          }

        });
        libraryMail.sendemail(' [ summarize ] ' + error, LMRY_script);
        return true;
      }
    }

    // Datos de la relación Banco - Transacción
    function obtenerDetalleRegistroObli(invoiceID, installmentNumber, documentEspecie, nossoNumber, status, processingDate, multa, moraPorDia) {
      var customer = obtenerDatosInvoice(invoiceID, installmentNumber);
      obtenerDatosCustomer(customer, invoiceID);
      var registroObligatorio = '\n' + obtenerDetalleRegistroObligatorio(invoiceID, installmentNumber, status, processingDate, nossoNumber, documentEspecie, multa, moraPorDia);
      return registroObligatorio;
    }

    //Datos de la transacción
    function obtenerDatosInvoice(id_invoice, installmentNumber) {
      var customer = "";
      try {
        var columns = [
          "internalid",
          "trandate",
          "duedate",
          "fxamount",
          "applyingtransaction",
          "applyingTransaction.fxamount"
        ];

        var FEAT_JOBS = runtime.isFeatureInEffect({ feature: "JOBS" });
        if (FEAT_JOBS == "T" || FEAT_JOBS == true) {
          columns.push("customermain.internalid");
        } else {
          columns.push("customer.internalid");
        }

        if (installmentNumber) {
          columns.push("installment.installmentnumber", "installment.fxamount", "installment.duedate");
        }

        var searchInvoice = search.create({
          type: "invoice",
          filters: [
            ["internalid", "anyof", id_invoice], "AND",
            ["mainline", "is", "T"], "AND",
            [
              ["applyingtransaction", "anyof", "@NONE@"], "OR",
              [
                ["applyingtransaction", "noneof", "@NONE@"], "AND",
                ["applyingtransaction.type", "anyof", "CustCred"], "AND",
                ["applyingtransaction.mainline", "is", "T"], "AND",
                ["applyingtransaction.memo", "startswith", "(LatamTax -  WHT)"], "AND",
                ["applyinglinktype", "anyof", "Payment"]
              ]
            ]
          ],
          columns: columns,
          settings: [search.createSetting({ name: 'consolidationtype', value: 'NONE' })]
        });

        var results = searchInvoice.run().getRange(0, 100);
        if (results && results.length) {
          var subsidiary = results[0].getValue("subsidiary");

          if (FEAT_JOBS == "T" || FEAT_JOBS == true) {
            customer = results[0].getValue({ name: "internalid", join: "customermain" })
          } else {
            customer = results[0].getValue({ name: "internalid", join: "customer" });
          }
          dateInvoice = results[0].getValue("trandate");
          if (dateInvoice) {
            dateInvoice = formatoFecha(dateInvoice);
          }

          dueDateInvoice = results[0].getValue("duedate");

          var idCreditMemo = results[0].getValue("applyingtransaction");

          if (installmentNumber) {
            for (var i = 0; i < results.length; i++) {
              var installNum = results[i].getValue({ name: "installmentnumber", join: "installment" }) || "";
              if (installNum) {
                if (Number(installNum) == Number(installmentNumber)) {
                  montoTotalInvoice = results[i].getValue({ name: "fxamount", join: "installment" }) || 0.00;
                  montoTotalInvoice = parseFloat(montoTotalInvoice);
                  dueDateInvoice = results[i].getValue({ name: "duedate", join: "installment" });
                  break;
                }
              }
            }

            if (idCreditMemo) {
              var whtRecord = record.load({
                type: "creditmemo",
                id: idCreditMemo
              });

              var numApply = whtRecord.getLineCount({ sublistId: "apply" });
              for (var i = 0; i < numApply; i++) {
                var installNum = whtRecord.getSublistValue({ sublistId: "apply", fieldId: "installmentnumber", line: i }) || "";
                var whtAmount = whtRecord.getSublistValue({ sublistId: "apply", fieldId: "amount", line: i }) || 0.00;
                var isApplied = whtRecord.getSublistValue({ sublistId: "apply", fieldId: "apply", line: i });
                if ((isApplied == "T" || isApplied == true) && Number(installmentNumber) == Number(installNum)) {
                  montoTotalInvoice = round2(montoTotalInvoice - parseFloat(whtAmount));
                }
              }
            }
          } else {
            montoTotalInvoice = results[0].getValue("fxamount") || 0.00;
            var whtAmount = results[0].getValue({ name: "fxamount", join: "applyingtransaction" }) || 0.00;
            whtAmount = Math.abs(whtAmount);
            montoTotalInvoice = round2(parseFloat(montoTotalInvoice) - parseFloat(whtAmount));
          }
          montoTotalInvoice = montoTotalInvoice.toFixed(2);
        }

        if (dueDateInvoice) {
          dueDateInvoice = formatoFecha(dueDateInvoice);
        }

        if (montoTotalInvoice) {
          montoTotalInvoice = formatoMonto(montoTotalInvoice);
        }
        return customer;
      } catch (error) {
        log.error('ERROR', '[ obtenerDatosInvoice ]');
        libraryMail.sendemail(' [ obtenerDatosInvoice ] ' + error, LMRY_script);
      }
    }

    // Datos del Customer
    function obtenerDatosCustomer(id_customer, internalId) {
      try {
        if (id_customer != null && id_customer != '') {

          ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

          var customer_columns = ['isperson', 'firstname', 'lastname', 'companyname'];

          /**
           * Para SuiteTax
           */
          if (ST_FEATURE || ST_FEATURE === "T") {
            var transObj = record.load({
              type: 'invoice',
              id: internalId,
              isDynamic: true
            });
            var customer_cnpj = transObj.getText({ fieldId: 'entitytaxregnum' });
          } else {
            customer_columns.push("vatregnumber");
          }

          var firtsName = '';
          var lastName = '';

          var recordCustomer = search.lookupFields({
            type: search.Type.CUSTOMER,
            id: id_customer,
            columns: customer_columns
          });

          var nom_customer = '';
          var typeCustomer = recordCustomer.isperson;

          //Si el Customer es persona natural typeCustomer es true
          if (typeCustomer == 'T' || typeCustomer == true) {
            var firtsName = recordCustomer.firstname;
            var lastName = recordCustomer.lastname;

            nom_customer = firtsName + ' ' + lastName;
            tipoCustomer = '01';

          } else {
            nom_customer = recordCustomer.companyname;
            tipoCustomer = '02';
          }

          // NOMBRE DEL CLIENTE
          if (nom_customer) {
            nomCustomer = nom_customer;
            nomCustomer = nomCustomer.toUpperCase();
          }

          //CNPJ DEL CLIENTE
          var cnpj_customer = "";
          if(!ST_FEATURE || ST_FEATURE === "F") {
            cnpj_customer = recordCustomer.vatregnumber;
          } else {
            cnpj_customer = customer_cnpj;
          }
          if (cnpj_customer)
            cnpjCustomer = cnpj_customer.replace(/\.|\-|\//g, '');


          // DIRECCIÓN DEL CLIENTE
          var billAdress1 = '';
          var billAdress2 = '';
          var billAdress3 = '';
          var billAdress4 = '';
          var billAdress5 = '';
          var billAdress6 = '';
          var billAdress7 = '';
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
              ["internalid", "anyof", internalId],
              "AND",
              ["mainline", "is", "T"]
            ]
          });

          var resultAddress = busqAddressRece.run().getRange(0, 10);

          if (resultAddress != null && resultAddress.length != 0) {
            row = resultAddress[0].columns;

            //ADDRESS 1
            billAdress1 = resultAddress[0].getValue(row[0]);
            if (billAdress1 == '' || billAdress1 == null) {
              billAdress1 = '';
            }

            //LATAM - ADDRESS NUMBER
            billAdress2 = resultAddress[0].getValue(row[1]);
            if (billAdress2 == '' || billAdress2 == null) {
              billAdress2 = '';
            }

            //LATAM - ADDRESS REFERENCE
            billAdress3 = resultAddress[0].getValue(row[2]);
            if (billAdress3 == '' || billAdress3 == null) {
              billAdress3 = '';
            }

            // ADDRESS 2 (Barrio)
            billAdress4 = resultAddress[0].getValue(row[3]);
            if (billAdress4 == '' || billAdress4 == null) {
              billAdress4 = '';
            }
            bairroCustomer = billAdress4;
            if (bairroCustomer != '') {
              bairroCustomer = bairroCustomer.toUpperCase();
            }

            // LATAM - CITY (Ciudad)
            billAdress5 = resultAddress[0].getText(row[4]);
            if (billAdress5 == '' || billAdress5 == null) {
              billAdress5 = '';
            }
            ciudadCustomer = billAdress5;

            // LATAM - PROVINCE ACRONYM
            billAdress6 = resultAddress[0].getValue(row[5]);
            if (billAdress6 == '' || billAdress6 == null) {
              billAdress6 = '';
            }
            ufCustomer = billAdress6;

            // ZIP - es el CEP del customer
            billAdress7 = resultAddress[0].getValue(row[6]);
            if (billAdress7 == '' || billAdress7 == null) {
              billAdress7 = '';
            }

            billAdress7 = billAdress7.replace(/[^0-9]/g, '');
            cepCustomer = billAdress7;

            // Country
            billAdress8 = resultAddress[0].getValue(row[7]);
            if (billAdress8 == '' || billAdress8 == null) {
              billAdress8 = '';
            }

          }

          //Arma la direccion: ADDRESS 1    LATAM - ADDRESS NUMBER   LATAM - ADDRESS REFERENCE
          addressCustomer = billAdress1 + ' ' + billAdress2 + ' ' + billAdress3;
          if (addressCustomer != '') {
            addressCustomer = addressCustomer.toUpperCase();
          }

        }
        return true;
      } catch (error) {
        log.error('ERROR', '[ obtenerDatosCustomer ]');
        libraryMail.sendemail(' [ obtenerDatosCustomer ] ' + error, LMRY_script);
      }

    }

    //Datos de la subsidiaria
    function obtenerDatosSubsidiaria(id_subsidiaria) {
      try {
        if (id_subsidiaria != 0) {

          ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

          var subsidiaria = record.load({
            type: record.Type.SUBSIDIARY,
            id: id_subsidiaria,
            isDynamic: true
          });

          /**
           * Para SuiteTax
           */
          if(ST_FEATURE || ST_FEATURE === "T") {
            var subsidiary_nexus = runtime.getCurrentScript().getParameter({ name: 'custscript_lmry_brd_subsidiary_nexus' });
            var taxregnum_lines_subsidiaries = subsidiaria.getLineCount({ sublistId: 'taxregistration' });
            for(var x = 0; x < taxregnum_lines_subsidiaries; x++) {
              var sub_nexus = subsidiaria.getSublistValue({ sublistId: 'taxregistration', fieldId: 'nexus', line: x });
              if(subsidiary_nexus === sub_nexus){
                var subsidiary_cnpj = subsidiaria.getSublistValue({ sublistId: 'taxregistration', fieldId: 'taxregistrationnumber', line: x });
                break;
              }
            }
          }

          var subsi_legalName = subsidiaria.getValue({
            fieldId: 'legalname'
          });

          if (subsi_legalName) {
            nombreSubsidiaria = subsi_legalName;
          } else {
            var subsi_name = subsidiaria.getValue({
              fieldId: 'name'
            });
            if (subsi_name)
              nombreSubsidiaria = subsi_name;
          }

          nombreSubsidiaria = nombreSubsidiaria.toUpperCase();

          var subsi_cnpj = "";
          if(!ST_FEATURE || ST_FEATURE === "F") {
            subsi_cnpj = subsidiaria.getValue({ fieldId: 'federalidnumber' });
          } else {
            subsi_cnpj = subsidiary_cnpj;
          }

          if (subsi_cnpj) {
            cnpjSubsidiaria = subsi_cnpj;
            cnpjSubsidiaria = cnpjSubsidiaria.replace(/\.|\-|\//g, '');
          }

        }
        return true;
      } catch (error) {
        log.error('ERROR', '[ obtenerDatosSubsidiaria ]');
        libraryMail.sendemail(' [ obtenerDatosSubsidiaria ] ' + error, LMRY_script);
      }
    }

    // Datos del Banco (Config Bank Ticket)
    function obtenerDatosConfigSubsidiariaBancoBradesco(id_subsidiary, pdf_bank) {
      try {
        var agency = '';
        var codBenef = '';
        //busqueda del record customrecord_lmry_br_config_bank_ticket para la config: Subsiiaria - BOA
        var searchConfigSubsiBank = search.create({
          type: 'customrecord_lmry_br_config_bank_ticket',
          columns: [{
            name: 'custrecord_lmry_beneficiary_code'
          }, {
            name: 'custrecord_lmry_code_bank'
          }, {
            name: 'custrecord_lmry_bank_code_cartera'
          }, {
            name: 'custrecord_lmry_bank_accept_bank_ticket'
          }, {
            name: 'custrecord_lmry_file_name'
          }, {
            name: 'custrecord_lmry_bank_agency'
          }, {
            name: 'custrecord_lmry_collection_number'
          }, {
            name: 'custrecord_lmry_portfolio_variation'
          }, {
            name: 'custrecord_lmry_shipping_sequential'
          }, {
            name: 'internalid'
          }],
          filters: [
            ['custrecord_lmry_name_subsidiary', 'is', id_subsidiary],
            'AND', ['custrecord_lmry_pdf_bank', 'is', pdf_bank]
          ]
        });
        var searchResult = searchConfigSubsiBank.run().getRange(0, 1);

        if (searchResult != '' && searchResult != null) {
          var columns = searchResult[0].columns;

          //Código de Beneficiario
          codBenef = searchResult[0].getValue(columns[0]);
          if (codBenef != null && codBenef != '') {
            codBenef = codBenef.replace('-', '');
            codigoBeneficiario = codBenef.substring(0, 7);
            dvCodigoBenef = codBenef.substring(7, 8);
            codigoBeneficiarioTotal = codigoBeneficiario + dvCodigoBenef;
          }

          //Código de Banco
          codigoBanco = searchResult[0].getValue(columns[1]);

          //Código de Cartera
          codigoCartera = searchResult[0].getValue(columns[2]);

          //Aceptación
          aceptacion = searchResult[0].getValue(columns[3]);

          if (aceptacion == 1) {
            aceptacion = "A";
          } else {
            aceptacion = "N";

          }

          var fileName = searchResult[0].getValue(columns[4]);
          if (fileName)
            file_name = '-' + fileName;

          agency = searchResult[0].getValue(columns[5]);
          if (agency != null && agency != '') {
            agency = agency.replace('-', '');
            agencia = agency.substring(0, 4);
            dvAgencia = agency.substring(4, 5);
          }

          var numeroConvenio = searchResult[0].getValue(columns[6]);
          if (numeroConvenio != null && numeroConvenio != '') {
            numConvenioCobranza = numeroConvenio;
          }

          var varCartera = searchResult[0].getValue(columns[7]);
          if (varCartera != null && varCartera != '') {
            variacionCartera = varCartera;
          }

          correlative_file = searchResult[0].getValue(columns[8]);

          configbank_id = searchResult[0].getValue(columns[9]);
        }
      } catch (error) {
        log.error('ERROR', '[ obtenerDatosConfigSubsidiariaBancoBradesco ]');
        libraryMail.sendemail(' [ obtenerDatosConfigSubsidiariaBancoBradesco ] ' + error, LMRY_script);
      }
    }

    //Estructura de Detalle de Registro Obligatorio (Archivo de envío)
    function obtenerDetalleRegistroObligatorio(invoiceID, installmentNumber, status, processingDate, nossoNumero, documentEspecie, multa, moraPorDia) {
      try {
        var string = "";
        installmentNumber = installmentNumber || "";

        var identifMulta = "0";
        if (multa) {
          identifMulta = "2";
          multa = multa.toFixed(2);
          multa = formatoMonto(multa);
        }

        if (moraPorDia) {
          moraPorDia = moraPorDia.toFixed(2);
          moraPorDia = formatoMonto(moraPorDia);
        }

        string += '1'; // Identificación de Registro Detalhe
        string += '00000';
        string += ' ';
        string += completarInicio(complementoRegistro, 12, '0');
        string += ' ';
        string += '0';
        string += completarInicio(codigoCartera, 3, '0') // Codigo Cartera
        string += completarInicio(agencia, 5, '0') // Codigo agency
        string += completarInicio(codigoBeneficiarioTotal, 8, '0') // Codigo Beneficiario
        string += completarFinal(invoiceID + installmentNumber, 25, ' '); //Nºro Controle Empresa
        string += completarInicio(codigoBanco, 3, '0'); //Código de Banco
        string += identifMulta; // Identificativo de Multa
        string += completarInicio(multa, 4, "0"); //Porcentaje de multa
        string += completarInicio(nossoNumero, 12, '0'); //Nosso Número
        string += completarInicio(complementoRegistro, 10, '0');
        string += '2N';
        string += completarFinal(complementoRegistro, 11, ' ');
        string += '0';
        string += completarFinal(complementoRegistro, 2, ' ');


        var comando = '';
        var fecha_procesamiento = '';
        var documentoEspecie = '';
        var codigo_estado_boletoBancario = '';

        //Busqueda Comando (Código de Ocurrencia)
        if (status != null && status != '' && status != undefined) {
          var searchBR_BB_status = search.create({
            type: 'customrecord_lmry_br_bb_status',
            columns: ['custrecord_lmry_br_bb_code'],
            filters: ['internalid', 'is', status]
          });
          searchResult = searchBR_BB_status.run().getRange(0, 1);
          if (searchResult != '' && searchResult != null) {
            codigo_estado_boletoBancario = searchResult[0].getValue({
              name: 'custrecord_lmry_br_bb_code'
            });
          }
        }
        if (codigo_estado_boletoBancario != '' && codigo_estado_boletoBancario != null) {
          comando = codigo_estado_boletoBancario;
        }

        if (processingDate) {
          fecha_procesamiento = formatoFecha(processingDate);
        } else {
          fecha_procesamiento = formatoFecha(new Date());
        }
        ////////// Fin de la busqueda

        //Busqueda codigo Documento Especie
        if (documentEspecie != null && documentEspecie != '' && documentEspecie != undefined) {
          var searchBR_BB_status = search.create({
            type: 'customrecord_lmry_br_document_specie',
            columns: ['custrecord_lmry_br_docu_specie_code'],
            filters: ['internalid', 'is', documentEspecie]
          });
          searchResult = searchBR_BB_status.run().getRange(0, 1);
          if (searchResult != '' && searchResult != null) {
            documentoEspecie = searchResult[0].getValue({
              name: 'custrecord_lmry_br_docu_specie_code'
            });
          }
        }
        if (documentoEspecie != '' && documentoEspecie != null) {
          codigoEspecieDoc = documentoEspecie;
        }

        ////////// Fin de la busqueda

        string += completarInicio(comando, 2, '0'); //Comando (Código de Ocurrencia)
        string += completarFinal(invoiceID, 10, ' '); //suNumero (CONSULTAR)
        string += completarFinal(dueDateInvoice, 6, '0'); // Fecha de vencimiento  (invoice y/o Boleto Bancario)
        string += completarInicio(montoTotalInvoice, 13, '0'); //valorTítulo
        string += completarInicio(complementoRegistro, 8, '0');
        string += completarInicio(codigoEspecieDoc, 2, '0'); //Especie do Titulo
        string += completarFinal(aceptacion, 1, ' '); //Aceite do Titulo
        string += completarInicio(fecha_procesamiento, 6, '0'); //fechaProcesamiento
        string += '00'; //Instrucción codificada
        string += '00'; //Instrucción codificada
        string += completarInicio(moraPorDia, 13, '0'); //Mora por dia
        string += completarInicio(complementoRegistro, 45, '0'); //
        string += completarInicio(tipoCustomer, 2, '0'); //tipoPagador
        string += completarInicio(cnpjCustomer, 14, '0'); //cnpjPagador
        string += completarFinal(nomCustomer, 40, ' '); //nombrePagador
        string += completarFinal(addressCustomer, 40, ' '); //direccionPagador
        string += completarFinal(complementoRegistro, 12, ' '); //Bairro Pagador
        string += completarInicio(cepCustomer, 8, '0'); //cepPagador
        string += completarInicio(complementoRegistro, 60, ' '); //Observações/Mensagem ou Sacador/Avalista
        //Seqüencial de Registro

        return string;
      } catch (error) {
        log.error('ERROR', '[ obtenerDetalleRegistroObligatorio ]');
        libraryMail.sendemail(' [ obtenerDetalleRegistroObligatorio ] ' + error, LMRY_script);
      }
    }

    function ValidarCaracteres_Especiales(s) {
      var AccChars = "ŠŽšžŸÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïðñòóôõöùúûüýÿ°–—ªº·";
      var RegChars = "SZszYAAAAAACEEEEIIIIDNOOOOOUUUUYaaaaaaceeeeiiiidnooooouuuuyyo--ao.";
      s = s.toString();
      for (var c = 0; c < s.length; c++) {
        for (var special = 0; special < AccChars.length; special++) {
          if (s.charAt(c) == AccChars.charAt(special)) {
            s = s.substring(0, c) + RegChars.charAt(special) + s.substring(c + 1, s.length);
          }
        }
      }
      return s;
    }

    //Añadir secuencial de registro al final de Detalle de Registro Obligatorio
    function concatenarSecuencia(texto, numeroSecuencia) {
      var numero = completarInicio(numeroSecuencia, 6, 0); // NÚMERO SEQÜENCIAL N(6) del Registro Obligatorio
      return texto + numero;
    }

    //Cabecera del Archivo de Envío
    function obtenerCabeceraArchivo(id_subsidiaria, id_banco) {
      obtenerDatosConfigSubsidiariaBancoBradesco(id_subsidiaria, id_banco);
      obtenerDatosSubsidiaria(id_subsidiaria);

      var string = "";

      string += '0'; // Identificación Registro Header
      string += '1'; // Tipo de Operación
      string += 'REMESSA'; //  Identificación Tipo de Operación: "REMESSA"
      string += '01'; // Tipo de Servicio
      string += completarFinal('COBRANCA', 15, ' '); // Identificación Tipo de Servicio: "COBRANCA”
      string += completarInicio(codigoBeneficiarioTotal, 20, '0'); //codigoBeneficiario
      string += completarFinal(nombreSubsidiaria, 30, ' '); //Nombre de la subsidiaria
      string += completarInicio(codigoBanco, 3, '0'); //Código de banco
      string += completarFinal(nombreBanco, 15, ' '); //Nombre de banco
      var fechaCreacion = new Date();
      fechaCreacion = formatoFecha(fechaCreacion);
      string += completarInicio(fechaCreacion, 6, '0'); //Fecha Grabacion del archivo de Remessa
      string += completarFinal(complementoRegistro, 8, ' '); //Complemento do Registro
      string += 'MX';
      /*
      string += completarInicio(parseInt(correlativeFile), 7, '0');
      string += completarFinal(complementoRegistro, 277, ' '); //Complemento de Registro A(258)
      string += '000001'; //Secuencial de Registro
      */
      return string;
    }

    function cabeceraCorrelativo() {
      var string = '';
      if (correlative_file != '' && correlative_file != null) {
        correlative_file = parseInt(correlative_file) + 1;
      } else {
        correlative_file = 1;
      }

      string += completarInicio(parseInt(correlative_file), 7, '0');
      string += completarFinal(complementoRegistro, 277, ' '); //Complemento de Registro A(258)
      string += '000001'; //Secuencial de Registro

      return string;
    }

    //Estructura de Trailer de Archivo (Archivo de envío)
    function obtenerTrailerArchivo(contador) {

      var string = '';
      string += '9'; //tipoRegistro
      string += completarInicio(complementoRegistro, 393, ' '); //Complemento de Registro A(393)
      string += completarInicio(contador, 6, '0'); //secuencia

      return string;

    }

    //Completar Inicio con ceros para campos numéricos
    function completarInicio(dato, cantMaxima, caracter) {
      var dato = dato.toString();
      while (dato.length < cantMaxima) {
        dato = caracter + dato
      }
      if (dato.lentgh == cantMaxima) {
        return dato;
      } else {
        dato = dato.substring(0, cantMaxima);
        return dato;
      }
    }

    //Completar Final con espacios en blanco para campos alfanuméricos
    function completarFinal(dato, cantMaxima, caracter) {
      var dato = dato.toString();
      while (dato.length < cantMaxima) {
        dato = dato + caracter
      }
      if (dato.lentgh == cantMaxima) {
        return dato;
      } else {
        dato = dato.substring(0, cantMaxima);
        return dato;
      }
    }

    function formatoFecha(fecha) {

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
      year = year.toString();
      formatoFechaNameFile = year + month + day;

      year = year.substring(2, 4);


      formatoFecha = day + month + year;
      return formatoFecha;
    }

    function formatoMonto(monto) {
      var monto_invoice = '';
      monto_invoice = monto.replace(',', '');
      monto_invoice = monto_invoice.replace('.', '');

      return monto_invoice;
    }

    function search_folder() {
      try {
        // Ruta de la carpeta contenedora
        var FolderId = runtime.getCurrentScript().getParameter({
          name: 'custscript_lmry_br_arquivo_remessa'
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

          // Valida si existe "Latam BR - Arquivo Remessa" en File Cabinet
          var varFolderId = '';
          var ResultSet = search.create({
            type: 'folder',
            columns: ['internalid'],
            filters: [
              ['name', 'is', 'Latam BR - Arquivo Remessa']
            ]
          });
          objResult = ResultSet.run().getRange(0, 50);

          if (objResult == '' || objResult == null) {
            var varRecordFolder = record.create({
              type: 'folder'
            });
            varRecordFolder.setValue('name', 'Latam BR - Arquivo Remessa');
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
            fieldId: 'custscript_lmry_br_arquivo_remessa',
            value: varFolderId
          });
          // save changes to the Company Preferences page
          varCompanyReference.save();
        }



      } catch (err) {
        libraryMail.sendemail(' [ search_folder ] ' + err, LMRY_script);
        // Mail de configuracion del folder
        //LIBRARY.sendMail(LMRY_script, ' [ onRequest ] ' + err);

      }
    }

    function round2(amount) {
      return Math.round(parseFloat(amount) * 1e2 + 1e-14) / 1e2;
    }

    return {
      getInputData: getInputData,
      map: map,
      summarize: summarize
    };
  });
