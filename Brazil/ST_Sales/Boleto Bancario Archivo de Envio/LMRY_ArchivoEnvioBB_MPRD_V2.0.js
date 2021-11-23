/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                    ||
||                                                             ||
||  File Name: LMRY_ArchivoEnvioBB_MPRD_V2.0.js     	         ||
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
  function(log, record, search, format, runtime, email, config, file, libraryMail) {

    //Datos de la Configuracion (Subsidiaria - Bank of America Merrill Lynch)
    var codigoBeneficiario = '';
    var dvCodigoBenef = '';
    var codigoCartera = '';
    var codigoBanco = '';
    var aceptacion = '';
    var cuentaCobro = '';
    var agencia = '';
    var dvAgencia = '';
    var numConvenioCobranza = '';
    var numConvenioLider = '';
    var variacionCartera = ''; //Configurar en Config Bank Ticket

    //Datos del Archivo
    var file_name = '';
    var formatoFechaNameFile = '';

    //Datos del Banco
    var ID_BANK = '';
    var nombreBanco = '001BANCODOBRASIL';

    //Datos de la Subsidiaria/Beneficiario
    var nombreSubsidiaria = '';
    var cnpjSubsidiaria = '';
    var ID_SUBSIDIARY = '';

    //Datos del Customer/Pagador
    var ID_CUSTOMER = '';
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
    var ID_INVOICE = '';

    //Datos del installments
    var ID_INST = '';
    var AMOUNT_INST = '';
    var DUEDATE_INST = '';
    var RETENCION_INST = '';

    //Datos del Transaction Fields
    var MORA_DIA = '';
    var MULTA = '';
    var COD_OCURRENCIA = '';
    var PROCESSING_DATE = '';
    var COD_DOCUMENT_SPECIE = '';

    var complementoRegistro = '';
    var COD_EMPRESA = '';
    var FLAG = '';

    // FEATURE SUITETAX
    var ST_FEATURE = false;

    var LMRY_script = 'LatamReady - Archivo de Envio BB Banco do Brasil MPRD';

    function getInputData() {
      try {
        //Crea la carpeta si no existe
        search_folder();

        var id_record_log = runtime.getCurrentScript().getParameter({name: 'custscript_lmry_bb_record_log_id_mprd'});

        var record_br_log_shipping_file = search.lookupFields({
          type: 'customrecord_lmry_br_log_shipping_file',
          id: id_record_log,
          columns: ['custrecord_lmry_br_log_subsidiary', 'custrecord_lmry_br_log_bank', 'custrecord_lmry_br_log_date_from', 'custrecord_lmry_br_log_date_to']
        });

        var subsidiaria = record_br_log_shipping_file.custrecord_lmry_br_log_subsidiary[0].value;
        var bank = record_br_log_shipping_file.custrecord_lmry_br_log_bank[0].value;
        var fecha_desde = record_br_log_shipping_file.custrecord_lmry_br_log_date_from;
        var fecha_hasta = record_br_log_shipping_file.custrecord_lmry_br_log_date_to;

        //Búsqueda de invoices
        var columns = [
          'trandate', 'subsidiary',
          'custrecord_lmry_br_related_transaction.custrecord_lmry_br_pdf_bank',
          'custrecord_lmry_br_related_transaction.custrecord_lmry_br_document_specie',
          'custrecord_lmry_br_related_transaction.custrecord_lmry_br_nosso_numero',
          'custrecord_lmry_br_related_transaction.custrecord_lmry_br_bb_status',
          'custrecord_lmry_br_related_transaction.custrecord_lmry_br_processing_date',
          'custrecord_lmry_br_related_transaction.custrecord_lmry_br_sacador_avalista',
          "custrecord_lmry_br_related_transaction.custrecord_lmry_br_send_multa",
          "custrecord_lmry_br_related_transaction.custrecord_lmry_br_send_interes"
        ];

        //Features
        var licenses = libraryMail.getLicenses(subsidiaria);
        var FEATURE_INST = runtime.isFeatureInEffect({feature: "installments"});

        if ((FEATURE_INST == 'T' || FEATURE_INST == true )&& libraryMail.getAuthorization(536, licenses)) {
          columns.push(search.createColumn({name: "internalid",sort: search.Sort.DESC}));
          columns.push(search.createColumn({name: "installmentnumber",join: "installment",sort: search.Sort.ASC}));
          columns.push("custrecord_lmry_br_related_transaction.custrecord_lmry_br_installments");
          columns.push("installment.amount");
          columns.push("installment.duedate");
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
          ],
          settings: [search.createSetting({ name: 'consolidationtype', value: 'NONE' })]
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

        ID_INVOICE = searchResult.id;
        //kEY
        var trandate = searchResult.values.trandate;

        //Datos del invoice
        ID_SUBSIDIARY = searchResult.values.subsidiary.value;
        ID_BANK = searchResult.values['custrecord_lmry_br_pdf_bank.custrecord_lmry_br_related_transaction'].value;
        NOSSO_NUMBER = searchResult.values['custrecord_lmry_br_nosso_numero.custrecord_lmry_br_related_transaction'];
        MORA_DIA = searchResult.values['custrecord_lmry_br_send_interes.custrecord_lmry_br_related_transaction'];
        MULTA = searchResult.values['custrecord_lmry_br_send_multa.custrecord_lmry_br_related_transaction'];
        RETENCION_INST = searchResult.values['custrecord_lmry_br_installments.custrecord_lmry_br_related_transaction'];
        ID_INST =  searchResult.values["installmentnumber.installment"];
        AMOUNT_INST =  searchResult.values["amount.installment"];
        DUEDATE_INST =  searchResult.values["duedate.installment"];

        //Datos del Transaction Fields
        var documentEspecie = searchResult.values['custrecord_lmry_br_document_specie.custrecord_lmry_br_related_transaction'].value;
        var status = searchResult.values['custrecord_lmry_br_bb_status.custrecord_lmry_br_related_transaction'].value;
        var processingDate = searchResult.values['custrecord_lmry_br_processing_date.custrecord_lmry_br_related_transaction'];

        obtenerDatosSubsidiaria();
        obtenerDatosConfigSubsidiariaBancoBB();

        context.write({
          key: trandate,
          value: obtenerDetalleRegistroObli(documentEspecie, status, processingDate) //+''+invoiceID;//secuencia temporal
        });
      } catch (error) {
        log.error('invoiceID - Trandate', ID_INVOICE + ' - ' + trandate);

        context.write({
          key: 0,
          value: ID_INVOICE
        });
      }

    }

    function summarize(context) {
      try {
      var array_file = {};
      var id_file_array = [];
      context.output.iterator().each(function(key, value) {

        if (array_file[key]) {
          array_file[key].push(value);
        } else {
          array_file[key] = [value];
        }

        return true;
      });

        if (array_file.length == 0)
          throw 'There is not content.';

        // Ruta de la carpeta contenedora
        var id_folder = runtime.getCurrentScript().getParameter({name: 'custscript_lmry_br_arquivo_remessa'});

        var id_record_log = runtime.getCurrentScript().getParameter({name: 'custscript_lmry_bb_record_log_id_mprd'});

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

        ID_SUBSIDIARY = record_br_log_shipping_file.custrecord_lmry_br_log_subsidiary[0].value;
        ID_BANK = record_br_log_shipping_file.custrecord_lmry_br_log_bank[0].value;

        var cabecera = obtenerCabeceraArchivo();

        for (var fecha in array_file) {
          formatoFecha(fecha);
          var cadena = cabecera;
          var j = 0;
          for (var i = 0; i < array_file[fecha].length; i++) {
            cadena += concatenarSecuencia(array_file[fecha][i].substring(0,395), j + 2);
            cadena += '\r\n';
            cadena += concatenarSecuencia(array_file[fecha][i].substring(395,790), j + 3);
            j=j+2;
          }
          cadena += '\n';
          cadena += obtenerTrailerArchivo(j + 2);

          cadena = ValidarCaracteres_Especiales(cadena);


          var fileRemesa = file.create({
            name: 'BBCollection-' + file_name + '-' + formatoFechaNameFile + '-' + horas + minutos + segundos + '.rem',
            fileType: file.Type.PLAINTEXT,
            contents: cadena,
            folder: id_folder
          });
          var id_file = fileRemesa.save();
          id_file_array.push(id_file);
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
        var id_record_log = runtime.getCurrentScript().getParameter({name: 'custscript_lmry_bb_record_log_id_mprd'});
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
    function obtenerDetalleRegistroObli(documentEspecie, status, processingDate) {
      obtenerDatosInvoice();
      obtenerDatosCustomer();
      obtenerDatosTransactionFields(status, documentEspecie, processingDate);
      calcularInstallments();
      var registroObligatorio = '\n' + obtenerDetalleRegistroObligatorio()+ obtenerDetalleMulta();
      return registroObligatorio;
    }

    //Datos de la transacción
    function obtenerDatosInvoice() {

      try {

        var recordInvoice = search.lookupFields({
          type: search.Type.INVOICE,
          id: ID_INVOICE,
          columns: ['subsidiary','entity', 'trandate', 'duedate', 'total', 'fxamount', 'custbody_lmry_wtax_code_des', 'custbody_lmry_wtax_amount']
        });

        ID_CUSTOMER = recordInvoice.entity[0].value;

        dateInvoice = recordInvoice.trandate;
        if (dateInvoice) {
          dateInvoice = formatoFecha(dateInvoice);
        }

        dueDateInvoice = recordInvoice.duedate;
        if (dueDateInvoice) {
          dueDateInvoice = formatoFecha(dueDateInvoice);
        }

        montoTotalInvoice = recordInvoice.fxamount;

        licenses = libraryMail.getLicenses(ID_SUBSIDIARY);

        /******************************************************************+******************************************
          - Descripción: Si esta activo el Feature  BR - LATAM WHT TAX y el campo tax_code_des tiene la descripción
            Latam - WHT Tax , Se resta el monto del invoice con el monto de la retencion (ID:custbody_lmry_wtax_amount)
         *************************************************************************************************************/

        var tax_code_des = recordInvoice.custbody_lmry_wtax_code_des;

        if (libraryMail.getAuthorization(416,licenses) == true && tax_code_des == 'Latam - WHT Tax') {
          FLAG = true;
          var retencion = recordInvoice.custbody_lmry_wtax_amount;
          montoTotalInvoice = montoTotalInvoice - retencion;
          montoTotalInvoice = montoTotalInvoice.toFixed(2);
        }

        //Monto concatenado
        if (montoTotalInvoice)
          montoTotalInvoice = formatoMonto(montoTotalInvoice);

      } catch (error) {
        log.error('ERROR', '[ obtenerDatosInvoice ]');
        libraryMail.sendemail(' [ obtenerDatosInvoice ] ' + error, LMRY_script);
      }

    }

    // Datos del Customer
    function obtenerDatosCustomer() {
      try{
      if (ID_CUSTOMER != null && ID_CUSTOMER != '') {

        var firtsName = '';
        var lastName = '';

        ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var customer_columns = ['isperson', 'firstname', 'lastname', 'companyname'];

        /**
         * Para SuiteTax
         */
        if (ST_FEATURE || ST_FEATURE === "T") {
          var transObj = record.load({
            type: 'invoice',
            id: ID_INVOICE,
            isDynamic: true
          });
          var customer_cnpj = transObj.getText({ fieldId: 'entitytaxregnum' });
        } else {
          customer_columns.push("vatregnumber");
        }

        var recordCustomer = search.lookupFields({
          type: search.Type.CUSTOMER,
          id: ID_CUSTOMER,
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
            ["internalid", "anyof", ID_INVOICE],
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

      }
      return true;

    }catch(error){
      log.error('ERROR', '[ obtenerDatosCustomer ]');
      libraryMail.sendemail(' [ obtenerDatosCustomer ] ' + error, LMRY_script);
    }

    }

    //Datos del Transaction Fields
    function obtenerDatosTransactionFields(status, documentEspecie, processingDate){
      try{
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
          COD_OCURRENCIA = codigo_estado_boletoBancario;
        }

        if (processingDate) {
          PROCESSING_DATE = formatoFecha(processingDate);
        } else {
          PROCESSING_DATE = formatoFecha(new Date());
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
          COD_DOCUMENT_SPECIE = documentoEspecie;
        }

        ////////// Fin de la busqueda

      }catch (error) {
        log.error('ERROR', '[ obtenerDatosTransactionFields ]');
        libraryMail.sendemail(' [ obtenerDatosTransactionFields ] ' + error, LMRY_script);
      }
    }

    //Datos Installment
    function calcularInstallments(){
      try{
        if(ID_INST != '' && ID_INST!= null){

          COD_EMPRESA = ID_INVOICE+'_'+ID_INST;
          if (DUEDATE_INST) {
            dueDateInvoice = formatoFecha(DUEDATE_INST);
          }
          montoTotalInvoice = AMOUNT_INST;

          //Cálculo de retención para installments
          var jsonInstallments = [];
          if (RETENCION_INST != '' && RETENCION_INST != null) {
            jsonInstallments = JSON.parse(RETENCION_INST);
          }

          if (Object.keys(jsonInstallments).length) {
            for (var idInstallment in jsonInstallments) {
              if(ID_INST == idInstallment){
                if (jsonInstallments[idInstallment]['wht'] && FLAG) {
                  var retencion = Math.round(parseFloat(jsonInstallments[idInstallment]['wht']) * 100) / 100;
                  retencion = retencion.toFixed(2);
                  montoTotalInvoice = Math.round((parseFloat(montoTotalInvoice) - parseFloat(retencion)) * 100) / 100;
                }
              }
            }
          }

          montoTotalInvoice = Number(montoTotalInvoice).toFixed(2);
          montoTotalInvoice = formatoMonto(montoTotalInvoice);

        }else{
          COD_EMPRESA = ID_INVOICE;
        }

      }catch (error) {
        log.error('ERROR', '[ calcularInstallments ]');
        libraryMail.sendemail(' [ calcularInstallments ] ' + error, LMRY_script);
      }
    }

    //Datos de la subsidiaria
    function obtenerDatosSubsidiaria() {
      try {
        if (ID_SUBSIDIARY != 0) {

          ST_FEATURE = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

          var subsidiaria = record.load({
            type: record.Type.SUBSIDIARY,
            id: ID_SUBSIDIARY,
            isDynamic: true
          });

          /**
           * Para SuiteTax
           */
          if(ST_FEATURE || ST_FEATURE === "T") {
            var subsidiary_nexus = runtime.getCurrentScript().getParameter({ name: 'custscript_lmry_bb_subsidiary_nexus' });
            var taxregnum_lines_subsidiaries = subsidiaria.getLineCount({ sublistId: 'taxregistration' });
            for(var x = 0; x < taxregnum_lines_subsidiaries; x++) {
              var sub_nexus = subsidiaria.getSublistValue({ sublistId: 'taxregistration', fieldId: 'nexus', line: x });
              if(subsidiary_nexus === sub_nexus){
                var subsidiary_cnpj = subsidiaria.getSublistValue({ sublistId: 'taxregistration', fieldId: 'taxregistrationnumber', line: x });
                break;
              }
            }
          }

          var subsi_legalName = subsidiaria.getValue({fieldId: 'legalname'});

          if (subsi_legalName) {
            nombreSubsidiaria = subsi_legalName;
          } else {
            var subsi_name = subsidiaria.getValue({
              fieldId: 'name'
            });
            if (subsi_name)
              nombreSubsidiaria = subsi_name;
          }

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
    function obtenerDatosConfigSubsidiariaBancoBB() {
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
          }],
          filters: [
            ['custrecord_lmry_name_subsidiary', 'is', ID_SUBSIDIARY],
            'AND', ['custrecord_lmry_pdf_bank', 'is', ID_BANK]
          ]
        });
        var searchResult = searchConfigSubsiBank.run().getRange(0, 1);

        if (searchResult != '' && searchResult != null) {
          var columns = searchResult[0].columns;

          //Código de Beneficiario
          codBenef = searchResult[0].getValue(columns[0]);
          if (codBenef != null && codBenef != '') {
            codBenef = codBenef.replace('-', '');
            codigoBeneficiario = codBenef.substring(0, 6);
            dvCodigoBenef = codBenef.substring(6, 7);
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

          //modificacion para el nombre del archivo de envio 3/10/2019
          file_name = searchResult[0].getValue(columns[4]);
          //Fin modificacion para el nombre del archivo de envio

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

        }
      } catch (error) {
        log.error('ERROR', '[ obtenerDatosConfigSubsidiariaBancoBB ]');
        libraryMail.sendemail(' [ obtenerDatosConfigSubsidiariaBancoBB ] ' + error, LMRY_script);
      }
    }

    //Estructura de Detalle de Registro Obligatorio (Archivo de envío)
    function obtenerDetalleRegistroObligatorio() {
      try {
        var string = "";
        if(MORA_DIA){
          MORA_DIA = formatoMonto(MORA_DIA);
        }

        string += '7'; // Identificación de Registro Detalhe
        string += '02' // Tipo Inscripcion Beneficiaro CNPJ (subsidiaria) CNPJ:02
        string += completarInicio(cnpjSubsidiaria, 14, '0'); // CNPJ Subsidiaria
        string += completarInicio(agencia, 4, '0'); //Prefijo de Agencia N(4)
        string += completarFinal(dvAgencia, 1, ''); //Digito verificador A(1)
        string += completarInicio(codigoBeneficiario, 8, '0'); //Prefijo de Agencia N(4)
        string += completarFinal(dvCodigoBenef, 1, ''); //Digito verificador A(1)
        string += completarInicio(numConvenioCobranza, 7, '0'); //Numero de Convenio Cobranza
        string += completarFinal(COD_EMPRESA, 25, ' '); //Código de Control de Empresa (Vacío)
        string += completarInicio(NOSSO_NUMBER, 17, '0'); //Nosso Número
        string += '00' //Número de Prestación
        string += '00' //Grupo de Valor
        string += completarFinal(complementoRegistro, 3, ' ');
        string += completarFinal(complementoRegistro, 1, ' '); //Indicativo Sacador/Avalista (vacío)
        string += completarFinal(complementoRegistro, 3, ' '); //Prefijo de titulo (vacío)
        string += completarInicio(variacionCartera, 3, '0'); // Variación Cartera
        string += '0' //Conta Caução
        string += '000000' //Número do Borderô
        string += completarFinal(complementoRegistro, 5, ' '); //Tipo de cobranza
        string += completarInicio(codigoCartera, 2, '0') // Codigo Cartera
        string += completarInicio(COD_OCURRENCIA, 2, '0'); //Comando (Código de Ocurrencia)
        string += completarFinal(ID_INVOICE, 10, ' '); //suNumero (CONSULTAR)
        string += completarFinal(dueDateInvoice, 6, '0'); // Fecha de vencimiento  (invoice y/o Boleto Bancario)
        string += completarInicio(montoTotalInvoice, 13, '0'); //valorTítulo
        string += completarInicio(codigoBanco, 3, '0'); //Código de Banco
        string += '0000'; //Prefijo de Agencia Cobradora
        string += completarFinal(complementoRegistro, 1, ' '); //Dígito verificador Agencia Cobradora
        string += completarInicio(COD_DOCUMENT_SPECIE, 2, '0'); //Especie do Titulo
        string += completarFinal(aceptacion, 1, ' '); //Aceite do Titulo
        string += completarInicio(PROCESSING_DATE, 6, '0'); //fechaProcesamiento
        string += '00'; //Instrucción codificada
        string += '00'; //Instrucción codificada
        string += completarInicio(MORA_DIA, 13, '0'); //Juros de Mora por Dia de Atraso
        string += completarInicio(complementoRegistro, 6, '0'); //fechaDescuento
        string += completarInicio(complementoRegistro, 13, '0'); //valorDescuento
        string += completarInicio(complementoRegistro, 13, '0'); //Valor do IOF/Qtde Unidade Variável.
        string += completarInicio(complementoRegistro, 13, '0'); //Valor do Abatimento
        string += completarInicio(tipoCustomer, 2, '0'); //tipoPagador
        string += completarInicio(cnpjCustomer, 14, '0'); //cnpjPagador
        string += completarFinal(nomCustomer, 37, ' '); //nombrePagador
        string += completarFinal(complementoRegistro, 3, ' '); //Complemento de Registro A(3)
        string += completarFinal(addressCustomer, 40, ' '); //direccionPagador
        string += completarFinal(bairroCustomer, 12, ' '); //Bairro Pagador
        string += completarInicio(cepCustomer, 8, '0'); //cepPagador
        string += completarFinal(ciudadCustomer, 15, ' '); //ciudadPagador
        string += completarFinal(ufCustomer, 2, ' '); //ufPagador
        string += completarInicio(complementoRegistro, 40, ' '); //Observações/Mensagem ou Sacador/Avalista
        string += completarInicio(complementoRegistro, 2, ' '); //Número de Dias Para Protesto ou Negativação
        string += 'N'; //Indicador de Recebimento Parcial
        //Seqüencial de Registro

        return string;
      } catch (error) {
        log.error('ERROR', '[ obtenerDetalleRegistroObligatorio ]');
        libraryMail.sendemail(' [ obtenerDetalleRegistroObligatorio ] ' + error, LMRY_script);
      }
    }

    function obtenerDetalleMulta() {
      try{
        var codMulta = 9;
        var fechaMulta = '';

        if(MULTA){
          codMulta = 2;
          fechaMulta = dueDateInvoice;
          MULTA = parseFloat(MULTA).toFixed(2);
          MULTA = formatoMonto(MULTA);
        }

        var string = "";
        string += '5'; //tipoRegistro
        string += '99'; //Tipo de Servicio
        string += completarInicio(codMulta, 1, '0') //Código de multa (Solo se admitirá porcentaje)
        string += completarInicio(fechaMulta, 6, '0'); //Fecha de multa (Data de multa)
        string += completarInicio(MULTA, 12, '0'); //Multa
        string += completarInicio(complementoRegistro, 3, '0'); //Cantidad días
        string += completarFinal(complementoRegistro, 369, ' '); //Brancos
        //Secuencial N(6)
        return string;

      }catch (error) {
        log.error('ERROR', '[ obtenerDetalleMulta ]');
        libraryMail.sendemail(' [ obtenerDetalleMulta ] ' + error, LMRY_script);
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
    function obtenerCabeceraArchivo() {
      obtenerDatosConfigSubsidiariaBancoBB();
      obtenerDatosSubsidiaria();
      var string = "";

      string += '0'; // Identificación Registro Header
      string += '1'; // Tipo de Operación
      string += 'REMESSA'; //  Identificación Tipo de Operación: "REMESSA"
      string += '01'; // Tipo de Servicio
      string += 'COBRANCA'; // Identificación Tipo de Servicio: "COBRANCA”
      string += completarFinal(complementoRegistro, 7, ' '); //Complemento de Registro A(7)
      string += completarInicio(agencia, 4, '0'); //Prefijo de Agencia N(4)
      string += completarFinal(dvAgencia, 1, ''); //Digito verificador A(1)
      string += completarInicio(codigoBeneficiario, 8, '0'); //Prefijo de Agencia N(4)
      string += completarFinal(dvCodigoBenef, 1, ''); //Digito verificador A(1)
      string += completarInicio(complementoRegistro, 6, '0'); //Complemento de Registro N(6)
      string += completarFinal(nombreSubsidiaria, 30, ' '); //Nombre de la subsidiaria
      string += completarFinal(nombreBanco, 18, ' '); //Nombre de banco
      var fechaCreacion = new Date();
      fechaCreacion = formatoFecha(fechaCreacion);
      string += completarInicio(fechaCreacion, 6, '0'); //Fecha Grabacion del archivo de Remessa
      string += '0000001' //Secuencial de REMESSA
      string += completarFinal(complementoRegistro, 22, ' '); //Complemento de Registro A(22)
      string += completarInicio(numConvenioLider, 7, '0'); //Numero de Convenio Lider (llenado con ceros)
      string += completarFinal(complementoRegistro, 258, ' '); //Complemento de Registro A(258)
      string += '000001' //Secuencial de Registro

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
      //log.debug('formatoFechaNameFile', formatoFechaNameFile);

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

    return {
      getInputData: getInputData,
      map: map,
      summarize: summarize
    };
  });
