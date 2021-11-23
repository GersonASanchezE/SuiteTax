/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for EI Avance Flow & Universal Setting         ||
||                                                              ||
||  File Name: LMRY_Invoicing_Populate_MPRD.js                  ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Jul 01 2019  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */
 /**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 */
define(['N/config', 'N/email','N/log','N/url','N/record','N/search','N/runtime','N/file',
        './EI_Library/LMRY_IP_libSendingEmailsLBRY_V2.0','./EI_Library/LMRY_EI_libSendingEmailsLBRY_V2.0',
        './EI_Conection/LMRY_EI_Conection_handler_LBRY_v2.0',
        '/SuiteBundles/Bundle 35754/Latam_Library/LMRY_UniversalSetting_LBRY',
        '/SuiteBundles/Bundle 35754/WTH_Library/LMRY_TAX_TransactionLBRY_V2.0',
        '/SuiteBundles/Bundle 35754/WTH_Library/LMRY_TAX_Withholding_LBRY_V2.0',
        '/SuiteBundles/Bundle 35754/WTH_Library/LMRY_AutoPercepcionDesc_LBRY_V2.0',
        '/SuiteBundles/Bundle 35754/WTH_Library/LMRY_TransferIva_LBRY',
        '/SuiteBundles/Bundle 35754/WTH_Library/LMRY_RetencionesEcuador_LBRY',
        './EI_Library/LMRY_seriesObject_LBRY_v2.0',
        '/SuiteBundles/Bundle 35754/WTH_Library/LMRY_ST_Tax_TransactionLBRY_V2.0',
        '/SuiteBundles/Bundle 35754/WTH_Library/LMRY_ST_Tax_Withholding_LBRY_V2.0'],

  function(config, email, log, url, record, search, runtime, file, libraryEmail, libraryFeature, libraryHandler,
        libraryUS,libraryTaxResult, libraryTaxWHT, libraryPercepcionesAR, libraryTransferIvaMX, libraryLatamTaxEC,
        ST_TAX_Transaction, ST_WHT_Transaction) {

          // './EI_Library/LMRY_TAX_TransactionLBRY_V2.0.js'
          //,'./EI_Library/LMRY_TAX_Withholding_LBRY_V2.0.js'

          /*
          '/SuiteBundles/Bundle 37714/WTH_Library/LMRY_TAX_TransactionLBRY_V2.0.js',
          '/SuiteBundles/Bundle 35754/WTH_Library/LMRY_TAX_Withholding_LBRY_V2.0.js'
          */

    //245636 : DESARROLLO
    //243159 : QA
    var scriptObj = runtime.getCurrentScript();
    var LMRY_script = 'Latamready - Invoicing Populate MPRD';

    var user_id = scriptObj.getParameter({name: 'custscript_lmry_ip_params_user'});
    var state_id = scriptObj.getParameter({name: 'custscript_lmry_ip_params_state'});

    var subsi_OW = runtime.isFeatureInEffect({feature: "SUBSIDIARIES"});

    // SuiteTax
    var F_SuiteTax = false;

    /**
     * Input Data for processing
     *
     * @return Array,Object,Search,File
     *
     * @since 2016.1
     */
    function getInputData() {

      try{

        var scriptObj = runtime.getCurrentScript();

        log.error('user y state',user_id + "-" + state_id);

        var current_log = search.lookupFields({type:'customrecord_lmry_invoicing_populate',id:state_id,columns:['custrecord_lmry_ip_transactions','custrecord_lmry_ip_subsidiary.country','custrecord_lmry_ip_subsidiary']});

        if(subsi_OW){
          var country = current_log['custrecord_lmry_ip_subsidiary.country'][0].text;
          country = country.substring(0,3).toUpperCase();
          var country_without = country;
          country = validarAcentos(country);

          var licenses = libraryFeature.getLicenses(current_log.custrecord_lmry_ip_subsidiary[0].value);

        }else{
          var countryConfig = config.load({type:config.Type.COMPANY_INFORMATION});
          var country = countryConfig.getText({fieldId:'country'});
          country = country.substring(0,3).toUpperCase();

          var country_without = country;
          country = validarAcentos(country);

          var allLicenses = libraryFeature.getAllLicenses();
          var keyMid = Object.keys(allLicenses)[0];
          var licenses = libraryFeature.getLicenses(keyMid);

        }

        var idFeature = {
          'AR': 341, 'BR': 339, 'CL': 342, 'CO': 343, 'CR': 523, 'EC': 601, 'MX': 338, 'PA': 441, 'PE': 344
        };

        //FUNCIONES OPTIMIZAR: SOLO UNA VEZ
        var fVip = false, fPreimpreso = false;

        if(subsi_OW){
          fVip = libraryFeature.getAuthorization(idFeature[current_log['custrecord_lmry_ip_subsidiary.country'][0].value],licenses);
          fPreimpreso = validarPreimpreso(licenses, current_log['custrecord_lmry_ip_subsidiary.country'][0].value);
        }else{
          fVip = libraryFeature.getAuthorization(idFeature[countryConfig.getValue('country')], licenses);
          fPreimpreso = validarPreimpreso(licenses, countryConfig.getValue('country'));
        }

        log.error('fPreimpreso',fPreimpreso);

        //UNIVERSAL SETTING
        var fUniversalSetting = libraryUS.auto_universal_setting(licenses, false);

        //TRANID
        var fTranid = false, fTranidPayment = false;
        if(country == 'MEX'){
          if(libraryFeature.getAuthorization(20, licenses)){
            if(libraryFeature.getAuthorization(314, licenses)){
              fTranid = true;
            }
            if(libraryFeature.getAuthorization(535, licenses)){
              fTranidPayment = true;
            }
          }

        }else if(country == 'BRA'){
          if(libraryFeature.getAuthorization(140, licenses) && libraryFeature.getAuthorization(308, licenses)){
            fTranid = true;
          }
        }else if(country == 'COL'){
          if(libraryFeature.getAuthorization(26, licenses) && libraryFeature.getAuthorization(310, licenses)){
            fTranid = true;
          }
        }

        log.error('Features: Vip - US - Tranid',[fVip,fUniversalSetting,fTranid].join('-'));

        //FEATURES DE DESARROLLOS
        var fPercepcionesAR = false, fTrasladoIvaMX = false, fTaxResultServBR = false, fRetencionesBR = false, fLatamTaxEC = false;

        switch(country){
          case 'ARG' : fPercepcionesAR = libraryFeature.getAuthorization(142, licenses);break;
          case 'BRA' : fTaxResultServBR = libraryFeature.getAuthorization(147, licenses);
                       fRetencionesBR = libraryFeature.getAuthorization(416, licenses);break;
          case 'ECU' : fLatamTaxEC = libraryFeature.getAuthorization(153, licenses);break;
          case 'MEX' : fTrasladoIvaMX = libraryFeature.getAuthorization(243, licenses);break;
        }

        //JSON DE TRANSACCIONES
        var id_transacciones = current_log.custrecord_lmry_ip_transactions;
        id_transacciones = id_transacciones.split('|');

        //SOLO MEXICO: PRE-IMPRESO
        if(country == 'MEX' && libraryFeature.getAuthorization(20, licenses)){

          var transIDs = id_transacciones.slice(0, id_transacciones.length - 1);

          if(subsi_OW){
            var transactionContext = librarySeries.getSeries(transIDs, current_log.custrecord_lmry_ip_subsidiary[0].value, fPreimpreso.slice(1,fPreimpreso.length));
          }else{
            var transactionContext = librarySeries.getSeries(transIDs, '', fPreimpreso.slice(1,fPreimpreso.length));
          }

          var serieByTransaction = transactionContext.transactions;
          var serieContext = librarySeries.load(transactionContext.series);

        }

        //SOLO BRAZIL: RPS
        if(subsi_OW){
          var jsonRPS = allGetRps(id_transacciones, current_log.custrecord_lmry_ip_subsidiary[0].value, country);
        }else{
          var jsonRPS = allGetRps(id_transacciones, '', country);
        }

        id_transacciones.push('');

        //JSON PARA LOS MAPS
        var prueba_json = [];
        for(var i=0;i<id_transacciones.length-1;i++){

          var prePrinted = '';
          if(country == 'MEX'){
            var serieId = serieByTransaction[id_transacciones[i]];
            prePrinted = serieContext.generateNumber(serieId);
          }

          prueba_json.push({
            key: i,
            values: {
              IDcurrentTransaction: id_transacciones[i],
              country: country,
              state: state_id,
              countryWithout: country_without,
              fVip: fVip,
              fPreimpresoInvoice: fPreimpreso[1],
              fPreimpresoCM: fPreimpreso[2],
              fPreimpresoIF: fPreimpreso[3],
              fPreimpresoPY: fPreimpreso[4],
              fTranid: fTranid,
              fTranidPayment: fTranidPayment,
              cantidadTransacciones: id_transacciones.length-1,
              countCurrentTransaction: i+1,
              fUniversalSetting: fUniversalSetting,
              fPercepcionesAR: fPercepcionesAR,
              fTrasladoIvaMX: fTrasladoIvaMX,
              fTaxResultServBR: fTaxResultServBR,
              fRetencionesBR: fRetencionesBR,
              fLatamTaxEC: fLatamTaxEC,
              licenses: licenses,
              rps: jsonRPS[id_transacciones[i]],
              preImpresoNumber: prePrinted
            }
          });
        }


        //MX: ACTUALIZACION DE SERIES - PREIMPRESO
        if(country == 'MEX'){
          serieContext.commit();
        }

        var id = record.submitFields({type: 'customrecord_lmry_invoicing_populate',id: state_id,
            values: {custrecord_lmry_ip_state: 'Procesando', custrecord_lmry_ip_user:user_id, custrecord_lmry_ip_count: id_transacciones.length - 1},
            options: {enableSourcing: false,ignoreMandatoryFields: true,disableTriggers:true}
        });

        return prueba_json;

      }catch(error){
        libraryEmail.sendemail(' [ getInputData ] ' + error, LMRY_script);
        var id = record.submitFields({type: 'customrecord_lmry_invoicing_populate',id: state_id,
            values: {custrecord_lmry_ip_state: 'Ocurrio un error: No se proceso ninguna transaccion'},
            options: {enableSourcing: false,ignoreMandatoryFields: true, disableTriggers: true}
        });
      }

    }


    /**
     * If this entry point is used, the map function is invoked one time for each key/value.
     *
     * @param {Object} context
     * @param {boolean} context.isRestarted - Indicates whether the current invocation represents a restart
     * @param {number} context.executionNo - Version of the bundle being installed
     * @param {Iterator} context.errors - This param contains a "iterator().each(parameters)" function
     * @param {string} context.key - The key to be processed during the current invocation
     * @param {string} context.value - The value to be processed during the current invocation
     * @param {function} context.write - This data is passed to the reduce stage
     *
     * @since 2016.1
     */
    function map(context) {

      try{

        var posible_error = 'Populado';
        var current_data = JSON.parse(context.value);

        var current_transaction = current_data.values.IDcurrentTransaction;
        var country = current_data.values.country;
        var state = current_data.values.state;
        var country_acento = current_data.values.countryWithout;
        var feature_vip = current_data.values.fVip;
        var featurePreimpresoInvoice = current_data.values.fPreimpresoInvoice;
        var featurePreimpresoCM = current_data.values.fPreimpresoCM;
        var featurePreimpresoIF = current_data.values.fPreimpresoIF;
        var featurePreimpresoPY = current_data.values.fPreimpresoPY;
        var feature_tranid = current_data.values.fTranid;
        var totalTransacciones = current_data.values.cantidadTransacciones;
        var numeroTransaccionActual = current_data.values.countCurrentTransaction;
        var featureUniversalSetting = current_data.values.fUniversalSetting;
        var featurePercepcionesAR = current_data.values.fPercepcionesAR;
        var featureTrasladoIvaMX = current_data.values.fTrasladoIvaMX;
        var featureTaxResultServBR = current_data.values.fTaxResultServBR;
        var featureRetencionesBR = current_data.values.fRetencionesBR;
        var featureLatamTaxEC = current_data.values.fLatamTaxEC;
        var featureTranidPayment = current_data.values.fTranidPayment;
        var currentRPS = current_data.values.rps;
        var preImpresoMX = current_data.values.preImpresoNumber;
        var licensesSub = current_data.values.licenses;

        // SuiteTax
        F_SuiteTax = runtime.isFeatureInEffect({ feature: 'tax_overhauling' });

        var search_transaction = search.lookupFields({type:search.Type.TRANSACTION,columns:['type'],id:current_transaction});
        search_transaction = search_transaction.type[0].value;

        var type_transaction = '', featurePreimpresoTransaction = false;
        var idTransaction = 7;

        if(search_transaction == 'CustInvc'){
          type_transaction = 'invoice';
          featurePreimpresoTransaction = featurePreimpresoInvoice;
        }

        if(search_transaction == 'CustCred'){
          type_transaction = 'creditmemo';
          featurePreimpresoTransaction = featurePreimpresoCM;
        }

        if(search_transaction == 'ItemShip'){
          type_transaction = 'itemfulfillment';
          featurePreimpresoTransaction = featurePreimpresoIF;
          idTransaction = 32;
        }

        if(search_transaction == 'CustPymt'){
          type_transaction = 'customerpayment';
          feature_tranid = featureTranidPayment;
          featurePreimpresoTransaction = featurePreimpresoPY;
        }

        // **************************************
        // load para Actualizacion de Campos
        // **************************************
        var id_load = record.load({type:type_transaction,id:current_transaction});

        // Populado Set Automatic Setting
        var document_type = id_load.getValue({fieldId:'custbody_lmry_document_type'});
        var seteoUS = false;

        if(featureUniversalSetting == true){
          libraryUS.set_inv_identifier(id_load);
          if(document_type == null || document_type == ''){
            libraryUS.automatic_setfield(id_load, false);
            libraryUS.automatic_setfieldrecord(id_load);
            libraryUS.set_template(id_load, licensesSub);
            seteoUS = true;
          }
        }

        //Campos de facturacion : E-Document Template y E-Document Sending Methods
        var ei_sending_templa = id_load.getValue({ fieldId : 'custbody_psg_ei_template'});
        var ei_sending_method = id_load.getValue({ fieldId : 'custbody_psg_ei_sending_method'});

        //Si existe template y sending method se cambio el estado For generation
        if (ei_sending_templa && ei_sending_method){
          // Se cambia el valor de :E-Document Status
          id_load.setValue({ fieldId : 'custbody_psg_ei_status', value : 1});
        }

        var sw_Continue = true;

        // Se valida si el tipo de documento fiscal no esta vacio
        var document_type = id_load.getValue({fieldId:'custbody_lmry_document_type'});
        if(document_type != null && document_type != ''){

          var search_doc_cod = '';
          if(country == 'BRA'){
            search_doc_cod = search.lookupFields({type:'customrecord_lmry_tipo_doc',id:document_type,columns:['custrecord_lmry_codigo_doc']});
            search_doc_cod = search_doc_cod.custrecord_lmry_codigo_doc;
            if(search_doc_cod != '55'){
              featurePreimpresoTransaction = false;
            }
          }

          // Seteo del Pre-impreso en la transaccion
          var serie_cxc = id_load.getValue({fieldId:'custbody_lmry_serie_doc_cxc'});
          if(serie_cxc != null && serie_cxc != '' && serie_cxc != -1 && featurePreimpresoTransaction == true){
            setearPreImpreso(id_load, country,feature_tranid, preImpresoMX);
          }

          // Para el automático OWN
          var ei_automatic = false;
          if(feature_vip == true){
            ei_automatic = true;
          }

          // Se cambia el valor de : Latam - EI Automatic
          id_load.setValue({ fieldId : 'custbody_lmry_mx_ei_automatic', value : ei_automatic});

          if(country == 'BRA'){
            // Se cambia el valor de : Latam - Applied WHT CODE
            id_load.setValue({ fieldId : 'custbody_lmry_apply_wht_code', value : true});

            // Logica para Inventariable
            if(search_doc_cod == '55'){
              posible_error = 'Tax Calculator';

              var id_con = idConnectionStatus(id_load, document_type, current_transaction, idTransaction);

              //Llama a la libreria Tax Calculator
              //'/SuiteBundles/Bundle 247582/EI Tax Calculator 2.0 Brasil/LMRY_BR_EI_TAXC_LBRY_V2.0.js',library_taxcalc
              require(['/SuiteBundles/Bundle 247582/EI Tax Calculator 2.0 Brasil/LMRY_BR_EI_TAXC_LBRY_V2.0.js'],
                    function (library_taxcalc) {
                        sw_Continue = library_taxcalc.calculateTaxes(id_load);
                    });

              //sw_Continue = library_taxcalc.calculateTaxes(id_load);

            }else{
              if(featureTaxResultServBR == true && seteoUS == true && type_transaction == 'invoice'){
                // Logica para Servicios
                posible_error = 'Tax Result Servicio';

                var json_taxresult = {type: 'edit', newRecord : id_load};
                if(F_SuiteTax == True || F_SuiteTax == "T") {
                  ST_TAX_Transaction.afterSubmitTransaction(json_taxresult, true);
                } else {
                  libraryTaxResult.afterSubmitTransaction(json_taxresult, true);
                }

              }
            }

          }else if(country == 'ARG' && featurePercepcionesAR == true && seteoUS == true){
            libraryPercepcionesAR.autoperc_beforeSubmit({newRecord : id_load}, 'AR', 'edit');
          }else if(country == 'MEX' && featureTrasladoIvaMX == true && type_transaction == 'invoice' && seteoUS == true){
            libraryTransferIvaMX.generateMXTransField({newRecord: id_load, check: false});
          }else if(country == 'ECU' && featureLatamTaxEC == true && type_transaction == 'invoice' && seteoUS == true){
            libraryLatamTaxEC.beforeSubmitTransaction({newRecord : id_load}, [], 'edit');
          }

          //SETEO DE CAMPOS DE E-DOCUMENT EN BLANCO CUANDO ES EL VIP
          if(feature_vip){
            id_load.setValue({ fieldId : 'custbody_psg_ei_template', value: ''});
            id_load.setValue({ fieldId : 'custbody_psg_ei_sending_method', value: ''});
            id_load.setValue({ fieldId : 'custbody_psg_ei_status', value : ''});
          }

        }

        // Graba la transaccion actualizada
        id_load.save({ignoreMandatoryFields: true, disableTriggers : true});

        //RETENCIONES BRAZIL
        if(country == 'BRA' && featureRetencionesBR == true && seteoUS == true && type_transaction == 'invoice'){
          if(F_SuiteTax == true || F_SuiteTax == "T") {
            ST_WHT_Transaction.LatamTaxWithHoldingBR(id_load, 'edit');
          } else {
            libraryTaxWHT.LatamTaxWithHoldingBR(id_load, 'edit');
          }
        }


        // **************************************
        // Fin para Actualizacion de Campos
        // **************************************

        if (document_type != null && document_type != ''){

          //AUTOFACT
          if(feature_vip == true && sw_Continue){
            posible_error = 'Generacion y Envio';
            var id_load4 = '';

            if(country == 'PER' || country == 'MEX' || country == 'COL' || country == 'CHI' || country == 'PAN' || country == 'COS' || country == 'ECU'){
              id_load4 = record.load({type: type_transaction, id: current_transaction});
            }else if(country == 'BRA'){

              var search_br_tran = search.create({type:'customrecord_lmry_br_transaction_fields',
                                                  filters:[{name:'custrecord_lmry_br_related_transaction',operator:'is',values:current_transaction}],
                                                  columns:['internalid']});

              var result_br_tran = search_br_tran.run().getRange({start:0,end:1});

              if(result_br_tran != null && result_br_tran.length > 0){
                id_load4 = record.load({type:'customrecord_lmry_br_transaction_fields',id:result_br_tran[0].getValue('internalid')});
              }

            }else{
              var search_ar_tran = search.create({type:'customrecord_lmry_ar_transaction_fields',filters:[{name:'custrecord_lmry_ar_transaction_related',operator:'is',values:current_transaction}],
              columns:['internalid']});

              var result_ar_tran = search_ar_tran.run().getRange({start:0,end:1});

              if(result_ar_tran != null && result_ar_tran.length > 0){
                id_load4 = record.load({type:'customrecord_lmry_ar_transaction_fields',id:result_ar_tran[0].getValue('internalid')});
              }
            }

            // Valida que continue con el proceso
            if(id_load4 != '' &&  sw_Continue){

              //BUSQUEDA TIPO DE DOCUMENTO
              var filtros_document = [], json_document = {};
              filtros_document[0] = search.createFilter({name:'isinactive',operator:'is',values:'F'});
              filtros_document[1] = search.createFilter({name:'custrecord_lmry_fact_electronica',operator:'is',values:'T'});
              filtros_document[2] = search.createFilter({name:'formulatext',formula:'{custrecord_lmry_country_applied}',operator:'startswith',values:country_acento});

              var search_document = search.create({type:'customrecord_lmry_tipo_doc',columns:['internalid'],filters:filtros_document});
              var result_document = search_document.run().getRange({start:0,end:1000});

              if(result_document != null && result_document.length > 0){
                for(var i=0;i<result_document.length;i++){
                  json_document[result_document[i].getValue('internalid')] = result_document[i].getValue('internalid');
                }
              }

              if(json_document[document_type] != null && json_document[document_type] != undefined){
                libraryHandler.generate_and_send(country,id_load4,currentRPS);
              }

            }
          }
        }

        //ACTUALIZACION PORCENTAJE
        record.submitFields({type: 'customrecord_lmry_invoicing_populate',id: state,
            values: {custrecord_lmry_ip_count: totalTransacciones + "|" + numeroTransaccionActual},
            options: {enableSourcing: false,ignoreMandatoryFields: true, disableTriggers:true}
        });

        posible_error = '';
        context.write({key:current_transaction,value:[state,'T',country,posible_error,feature_vip]});

      }catch(error){

        record.submitFields({type: 'customrecord_lmry_invoicing_populate',id: state,
            values: {custrecord_lmry_ip_count: totalTransacciones + "|" + numeroTransaccionActual},
            options: {enableSourcing: false,ignoreMandatoryFields: true,disableTriggers:true}
        });

        log.error('Error catch [MAP]',error.valueOf().toString());
        if(error.valueOf().toString().indexOf("SSS_REQUEST_TIME_EXCEEDED") == -1){
          context.write({key:current_transaction,value:[state,'F',country,posible_error,feature_vip]});
        }else{
          context.write({key:current_transaction,value:[state,'T',country,posible_error,feature_vip]});
        }
      }

    }


    /**
     * If this entry point is used, the reduce function is invoked one time for
     * each key and list of values provided..
     *
     * @param {Object} context
     * @param {boolean} context.isRestarted - Indicates whether the current invocation represents a restart
     * @param {number} context.executionNo - Version of the bundle being installed
     * @param {Iterator} context.errors - This param contains a "iterator().each(parameters)" function
     * @param {string} context.key - The key to be processed during the current invocation
     * @param {string} context.value - The value to be processed during the current invocation
     * @param {function} context.write - This data is passed to the reduce stage
     *
     * @since 2016.1
     */
    function reduce(context) {

    }

    /**
     * If this entry point is used, the reduce function is invoked one time for
     * each key and list of values provided..
     *
     * @param {Object} context
     * @param {boolean} context.isRestarted - Indicates whether the current invocation of the represents a restart.
     * @param {number} context.concurrency - The maximum concurrency number when running the map/reduce script.
     * @param {Date} context.datecreated - The time and day when the script began running.
     * @param {number} context.seconds - The total number of seconds that elapsed during the processing of the script.
     * @param {number} context.usage - TThe total number of usage units consumed during the processing of the script.
     * @param {number} context.yields - The total number of yields that occurred during the processing of the script.
     * @param {Object} context.inputSummary - Object that contains data about the input stage.
     * @param {Object} context.mapSummary - Object that contains data about the map stage.
     * @param {Object} context.reduceSummary - Object that contains data about the reduce stage.
     * @param {Iterator} context.ouput - This param contains a "iterator().each(parameters)" function
     *
     * @since 2016.1
     */
    function summarize(context) {

      try{

        //var LMRY_script = 'Latamready - Invoicing Populate MR';
        var state = '';
        var transaction_f = '';
        var c1=0,c2 = 0;
        var country = '';
        var posible_error = '';
        var lista_invoices = [];
        var feature_vip = '';

        context.output.iterator().each(function(key,value){
          value = JSON.parse(value);
          state = value[0];
          country = value[2];
          feature_vip = value[4];
          c1++;
          lista_invoices.push(key);

          if(value[1] == 'F'){
            transaction_f = transaction_f + key + "|";
            posible_error = posible_error + value[3] + "|";
            c2++;
          }

          return true;
        })

        var link = url.resolveScript({scriptId:'customscript_lmry_ei_mass_edocument_stlt',deploymentId:'customdeploy_lmry_ei_mass_edocument_stlt',returnExternalUrl:false});

        var r_load = record.load({type:'customrecord_lmry_invoicing_populate',id:state_id});

        var subsidiary = subsi_OW ? r_load.getText({fieldId:'custrecord_lmry_ip_subsidiary'}) : '';

        if(c1 != c2 && feature_vip == false){
          r_load.setValue({fieldId:'custrecord_lmry_ip_url',value:link});
        }

        if(transaction_f == ''){
          r_load.setValue({fieldId:'custrecord_lmry_ip_state',value:'Finalizado'});
        }else{
          r_load.setValue({fieldId:'custrecord_lmry_ip_state',value:'Ocurrio un error. Fallaron las siguiente(s) transacciones: \n'+transaction_f});
          r_load.setValue({fieldId:'custrecord_lmry_ip_error',value:posible_error});
        }

        r_load.save({disableTriggers: true, ignoreMandatoryFields: true});

        //ENVIO DE CORREO EXITOSOS
        if(feature_vip == true){
          sleep(10000);
          status(country,lista_invoices,subsidiary);
        }

      }catch(error){
        libraryEmail.sendemail(' [ Summarize ] ' + error, LMRY_script);
        log.error('Summarize',error);
      }

    }

    function validarPreimpreso(licenses, country){
      var devolver = [false,false,false,false,false];

      //Localizacion - Transaction Number Invoice, TN Credit Memo, TN Item Fulfillment, TN Payment
      var features = {'MX': [20,132,425,425,146], 'BR': [140,305,305,526,526], 'CO': [26,387,419,419,419]};

      if(features[country]){
        for(var i = 0; i < features[country].length; i++){
          if(!libraryFeature.getAuthorization(features[country][0],licenses)){
            break;
          }
          devolver[i] = libraryFeature.getAuthorization(features[country][i],licenses);
        }
      }

      return devolver;

    }


    function setearPreImpreso(invoice,country,feature_tranid, preImpresoMX){

      var pre_impreso = invoice.getValue('custbody_lmry_num_preimpreso');

      if(country == 'MEX'){

        if(!pre_impreso){
          invoice.setValue('custbody_lmry_num_preimpreso', preImpresoMX);
        }

        setearTranId(invoice, country, feature_tranid);

      }else{

        var serieCxc = invoice.getValue('custbody_lmry_serie_doc_cxc');

        if(pre_impreso == null || pre_impreso == ''){
          // Trae el ultimo numero pre-impreso
          var wtax_type = search.lookupFields({type: 'customrecord_lmry_serie_impresion_cxc',id: serieCxc,
            columns: ['custrecord_lmry_serie_numero_impres', 'custrecord_lmry_serie_rango_fin', 'custrecord_lmry_serie_num_digitos']
          });

          var nroConse = parseInt(wtax_type.custrecord_lmry_serie_numero_impres) + 1;
          var nroConse_2 = nroConse;
          var maxPermi = parseInt(wtax_type.custrecord_lmry_serie_rango_fin);
          var digitos = parseInt(wtax_type.custrecord_lmry_serie_num_digitos);

          if(digitos != null && digitos != '' && nroConse <= maxPermi){
            var longNumeroConsec = parseInt((nroConse + '').length);
            var llenarCeros = '';
            for (var i = 0; i < (digitos - longNumeroConsec); i++) {
              llenarCeros += '0';
            }
            nroConse = llenarCeros + nroConse;

            if(nroConse != null && nroConse != ''){
              invoice.setValue({ fieldId : 'custbody_lmry_num_preimpreso', value : nroConse});

              // Actualiza el numero Correlativo en las series de impresion
              var upd_serie = record.submitFields({type:'customrecord_lmry_serie_impresion_cxc',id:serieCxc,
              values:{'custrecord_lmry_serie_numero_impres':nroConse_2}, options: {disableTriggers: true, ignoreMandatoryFields: true}});
            }

            // Valida Feature y actualiza la transaccion
            setearTranId(invoice,country,feature_tranid);
          }
        }

      }// NO ES MX


    }

    function setearTranId(invoice, country,feature_tranid){

        if(feature_tranid == true){

            posible_error = 'Tranid';

            var urlpais = runtime.getCurrentScript().getParameter('custscript_lmry_netsuite_location');

            var tranprefix = '';
            if(subsi_OW){
              var subsidiaria = invoice.getValue({fieldId:'subsidiary'});
              tranprefix = getPrefijo(subsidiaria);
            }

            // Tipo de Documento Fiscal
            var DocuTipo = invoice.getValue({fieldId:'custbody_lmry_document_type'});
            if (DocuTipo != null && DocuTipo != ''){
                DocuTipo = search.lookupFields({type: 'customrecord_lmry_tipo_doc', id: DocuTipo, columns: ['custrecord_lmry_doc_initials']});
                DocuTipo = DocuTipo.custrecord_lmry_doc_initials;
            }
            if (DocuTipo == '' || DocuTipo == null) {
              DocuTipo = '';
            }
            // Series de Impresios
            var DocuSeri = invoice.getValue({fieldId:'custbody_lmry_serie_doc_cxc'});
            if (DocuSeri != null && DocuSeri != ''){
                DocuSeri = search.lookupFields({type:'customrecord_lmry_serie_impresion_cxc', id:DocuSeri, columns:['name']});
                DocuSeri = DocuSeri.name;
            }
            // Numero Preimpreso
            var DocuPrei = invoice.getValue({fieldId:'custbody_lmry_num_preimpreso'});

            // Se Arama el TranID

            var texto = '';
            if (tranprefix != '' && tranprefix != null) {
              texto = tranprefix + ' ' + DocuTipo.toUpperCase() + ' ' + DocuSeri + '-' + DocuPrei;
            } else {
              texto = DocuTipo.toUpperCase() + ' ' + DocuSeri + '-' + DocuPrei;
            }

            // Mejora 24-10-2019
            if (texto!='' && texto!=null){
              invoice.setValue({ fieldId : 'tranid', value : texto});
              //log.error('setearTranId', texto);
            }
        }
    }

    // Prefijo de la Subsidiaria
    function getPrefijo(subsidiaria){

      var featuresubs = runtime.isFeatureInEffect({feature: 'SUBSIDIARIES'});
      var strdata = '';

      if(featuresubs == true || featuresubs == 'T'){
        strdata = search.lookupFields({type: 'subsidiary',id: subsidiaria,columns: ['tranprefix']});
        strdata = strdata.tranprefix;
      }

      return strdata;

    }

    function sleep(milliseconds) {
      var start = new Date().getTime();
      for (var i = 0; i < 1e7; i++) {
        if((new Date().getTime() - start) > milliseconds) {
          break;
        }
      }
    }

    function idConnectionStatus(id_load_2,document_type,current_transaction, idTransaction){

      var id_con = '';

      var filtrosPackage = [];
      filtrosPackage[0] = search.createFilter({name: 'custrecord_lmry_ei_pckg_doc_type', operator: 'equalto', values: document_type});
      filtrosPackage[1] = search.createFilter({name: 'custrecord_lmry_ei_pckg_trans_type', operator: 'anyof', values: idTransaction});
      if(subsi_OW){
        filtrosPackage[2] = search.createFilter({name: 'custrecord_lmry_ei_pckg_subsi', operator: 'anyof', values: id_load_2.getValue('subsidiary')});
      }

      var objbusqPrueba = search.create({type: 'customrecord_lmry_ei_pckg',
          columns: ['custrecord_lmry_ei_pckg_subsi', 'custrecord_lmry_ei_pckg_doc_type',
              'custrecord_lmry_ei_pckg_template', 'custrecord_lmry_ei_pckg_sm'],
          filters: filtrosPackage});

      var resultadoPrueba = objbusqPrueba.run().getRange(0, 50);

      //SOLO AGARRA EL PRIMER VALOR YA QUE DEBE IR DENTRO DE UN FOR
      if (resultadoPrueba != null && resultadoPrueba.length != 0) {
          var row = resultadoPrueba[0].columns;
          var subsi = resultadoPrueba[0].getValue(row[0]);
          var _doc_fiscal = resultadoPrueba[0].getValue(row[1]);
          var template = resultadoPrueba[0].getValue(row[2]);
          var send_method = resultadoPrueba[0].getValue(row[3]);

          if ((template != null && template != '') && (send_method != null && send_method != '')) {

              /* RECORD: LatamReady - EI Connection Status*/
              var busqeiprint = search.create({
                  type: 'customrecord_lmry_ei_con_status',
                  columns: ['custrecord_lmry_ei_con_rel_txn', 'custrecord_lmry_ei_con_subsidiary', 'custrecord_lmry_ei_con_doc', 'custrecord_lmry_ei_con_temp',
                      'custrecord_lmry_ei_con_sm', 'custrecord_lmry_ei_con_status'
                  ],
                  filters: [
                      ['custrecord_lmry_ei_con_rel_txn', 'anyof', current_transaction]
                  ]
              });

              var resultprint = busqeiprint.run().getRange(0, 1000);

              var connectionprint = '';
              if (resultprint == null || resultprint.length == 0) {
                  /*Llenado de tabla: LatamReady - EI Connection Status*/
                  connectionprint = record.create({ type: 'customrecord_lmry_ei_con_status' });
                  connectionprint.setValue('custrecord_lmry_ei_con_rel_txn', current_transaction);
                  connectionprint.setValue('custrecord_lmry_ei_con_status', 1);
              } else {
                  connectionprint = record.load({ type: 'customrecord_lmry_ei_con_status', id: resultprint[0].id })
              }

              if(subsi_OW){
                connectionprint.setValue('custrecord_lmry_ei_con_subsidiary', subsi);
              }

              connectionprint.setValue('custrecord_lmry_ei_con_doc', _doc_fiscal);
              connectionprint.setValue('custrecord_lmry_ei_con_temp', template);
              connectionprint.setValue('custrecord_lmry_ei_con_sm', send_method);
              id_con = connectionprint.save({disableTriggers: true, ignoreMandatoryFields: true});

          } else {
              //log.error('Setup Error', 'No se encontró en el EI Package los parámetros Template y Sending Method');
              return true;
          }

      }

      return id_con;
    }

    // Se realiza la validacion para Mexico
    function validarAcentos(s) {
      var AccChars = "ŠŽšžŸÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïðñòóôõöùúûüýÿ&°–—ªº·";
      var RegChars = "SZszYAAAAAACEEEEIIIIDNOOOOOUUUUYaaaaaaceeeeiiiidnooooouuuuyyyo--ao.";

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

    function status(country,arregloInvoice,subsidiary){

      //STATUS, STATUS-COUNTRY, HORA-COUNTRY, STATUS-GLOBAL, HORA-GLOBAL
      var json_full = {};

      for(var j=0;j<arregloInvoice.length;j++){
        json_full[arregloInvoice[j]] = [];
        json_full[arregloInvoice[j]].push('No');
        json_full[arregloInvoice[j]].push('No');
        json_full[arregloInvoice[j]].push('No');
        json_full[arregloInvoice[j]].push('No');
      }

      var posicion = -1;

      //BRAZIL, ARGENTINA, CHILE, COLOMBIA, PANAMA: LatamReady - EI Documents Status
      //var record = ['customrecord_lmry_ar_fel_estado','customrecord_lmry_ei_docs_status','customrecord_lmry_cl_ei_docs_status','customrecord_lmry_co_ei_docs_status'];
      var record = ['customrecord_lmry_ei_docs_status'];
      //STATUS
      /*var columnas = ['custrecord_lmry_ar_estado_comfiar','custrecord_lmry_ei_ds_doc_status','custrecord_lmry_cl_ei_doc_status','custrecord_lmry_co_ei_doc_status',
      'custbody_lmry_pe_estado_sf','custbody_lmry_pe_estado_comfiar'];*/
      var columnas = ['custrecord_lmry_ei_ds_doc_status','custbody_lmry_pe_estado_sf','custbody_lmry_pe_estado_comfiar'];
      //IDS
      //var columnas2 = ['custrecord_lmry_ar_fel_transac','custrecord_lmry_ei_ds_doc','custrecord_lmry_cl_ei_doc','custrecord_lmry_co_ei_doc'];
      var columnas2 = ['custrecord_lmry_ei_ds_doc'];

      switch (country){
        case 'ARG': posicion = 0;break;
        case 'BRA': posicion = 0;break;
        case 'CHI': posicion = 0;break;
        case 'COL': posicion = 0;break;
        case 'MEX': posicion = 1;break;
        case 'PER': posicion = 2;break;
        case 'PAN': posicion = 0;break;
        case 'COS': posicion = 0;break;
        case 'ECU': posicion = 0;break;
      }

      var c = 0,bandera = true;
      while(bandera){
        var aux = arregloInvoice.slice(c,c+900);

        if(aux.length == 900){
          c = c+900;
        }else{
          bandera = false;
        }

        //custrecord_lmry_ar_fel_transac,custrecord_lmry_cl_ei_doc,custrecord_lmry_co_ei_doc

        var filtros = [
          search.createFilter({name:'custrecord_lmry_ei_ds_doc',operator:'anyof',values:aux})
        ]

        if(country == 'MEX' || country == 'PER'){

          var search_custbody = search.create({type:'transaction',columns:[columnas[posicion],'internalid'],filters:[{name:'internalid',operator:'anyof',values:aux},
          {name:'mainline',operator:'is',values:'T'},{name:'type',operator:'anyof',values:['CustCred','CustInvc','CustPymt']}]
          });
          var result_custbody = search_custbody.run().getRange({start:0,end:900});

          if(result_custbody != null && result_custbody.length > 0){
            for(var i=0;i<result_custbody.length;i++){
              json_full[result_custbody[i].getValue('internalid')][0] = result_custbody[i].getValue(columnas[posicion]);
            }
          }

        }else{

          //RECORD COUNTRY
          var search_r_status = search.create({type:record[posicion],columns:[columnas[posicion],columnas2[posicion],'lastmodified'],filters:[filtros[posicion]]});
          var result_r_status = search_r_status.run().getRange({start:0,end:900});

          // Visualiza el resultado de una busqueda

          if(result_r_status != null && result_r_status.length > 0){
            for(var i=0;i<result_r_status.length;i++){
              json_full[result_r_status[i].getValue(columnas2[posicion])][0] = result_r_status[i].getValue(columnas[posicion]);
            }
          }
        }
      }

      var status_countries = ['Aprobado', 'Observado', 'EMITIDO', 'APROBADO POR SII', 'APROBADO', 'AUTORIZADO', 'Procesando', 'PROCESANDO', 'Autorizado', 'Generado','ACEPTADO','Cancelada','Cancelado','Denegada','Cancelando','No Cancelado','No Cancelada','EMILOCAL'];
      var status_countries_error = ['Error','ERROR','Rechazado','RECHAZADO'];

      var aprobados = [];
      var fallidos = [];
      var procesando = [];
      var error = [];

      log.error('jsonFull',json_full);

      for(var i=0;i<arregloInvoice.length;i++){
        if(status_countries.indexOf(json_full[arregloInvoice[i]][0]) != -1){
          aprobados.push(arregloInvoice[i]);
          json_full[arregloInvoice[i]][1] = 'Aprobado';
        }else if(json_full[arregloInvoice[i]][0] == 'No' || json_full[arregloInvoice[i]][0] == ''){
          procesando.push(arregloInvoice[i]);
          json_full[arregloInvoice[i]][1] = 'Procesando';
        }else{
          fallidos.push(arregloInvoice[i]);
          json_full[arregloInvoice[i]][1] = 'Rechazado';
        }
      }

      json_full = tranid_json(json_full,arregloInvoice);

      c = 0;
      bandera = true;

      //FALLIDOS
      //ARGENTINA-BRAZIL-CHILE-COLOMBIA-MEXICO-PERU: LatamReady - EI Log of Documents
      //var record_f = ['customrecord_lmry_ar_fel_lote_envio','customrecord_lmry_ei_log_docs','customrecord_lmry_cl_ei_log_docs','customrecord_lmry_co_ei_log_docs','customrecord_lmry_mx_fel_log_docs','customrecord_lmry_pe_fel_lote_envio'];
      //var response_f = ['custrecord_lmry_ar_envio_resp','custrecord_lmry_ei_ld_response','custrecord_lmry_cl_ei_response','custrecord_lmry_co_ei_response','custrecord_lmry_mx_fel_response','custrecord_lmry_pe_envio_resp'];
      var formula_f = ['{custrecord_lmry_ar_envio_transac.internalid}','{customrecord_lmry_ei_log_docs.internalid}','{custrecord_lmry_cl_ei_document.internalid}','{custrecord_lmry_co_ei_document.internalid}','{custrecord_lmry_mx_fel_document.internalid}','{custrecord_lmry_pe_envio_transac.internalid}'];
      //var invoice_f = ['custrecord_lmry_ar_envio_transac','custrecord_lmry_ei_ld_doc','custrecord_lmry_cl_ei_document','custrecord_lmry_co_ei_document','custrecord_lmry_mx_fel_document','custrecord_lmry_pe_envio_transac'];

      log.error('Fallidos',fallidos);
      log.error('Cantidad de fallidos',fallidos.length);

      if(fallidos.length > 0){

        var aux = [];
        var aux_id = [];
        var aux2 = [];
        while(bandera){
          var fallidos_c = fallidos.slice(c,c+900);
          if(fallidos_c.length == 900){
            c = c+ 900;
          }else{
            bandera = false;
          }

          var search_fallidos = search.create({type:'customrecord_lmry_ei_log_docs',filters:[{name:'custrecord_lmry_ei_ld_doc',operator:'anyof',values:fallidos_c}],
            columns:[{name:'custrecord_lmry_ei_ld_doc',sort:search.Sort.DESC},{name:'internalid',sort:search.Sort.DESC}]
          });

          var c2 = 0;

          var run_fallidos = search_fallidos.run();
          var run_fallidos2 = run_fallidos.getRange({start:c2,end:c2+900});

          //log.error('run_fallidos2',run_fallidos2);

          var bandera2 = true;

          if(run_fallidos2 != null && run_fallidos2.length > 0){
            while(bandera2){
              var run_fallidos2 = run_fallidos.getRange({start:c2,end:c2+900});
              for(var i=0;i<run_fallidos2.length;i++){
                var columnas_run = run_fallidos2[0].columns;
                aux.push(run_fallidos2[i].getValue(columnas_run[1]));
                aux_id.push(run_fallidos2[i].getValue(columnas_run[0]));
              }

              if(run_fallidos2.length == 900){
                c2 = c2 + 900;
              }else{
                bandera2 = false;
              }

            }

            //log.error('aux',aux);

            for(var a=0;a<aux_id.length;a++){
              if(a==0){aux2.push(aux[a]);}
              if(a >0){
                if(aux_id[a] != aux_id[a-1]){
                  aux2.push(aux[a]);
                }
              }

            }

          }

          //aux =  (aux.length) ? aux : '';

          //log.error('aux2', aux2);

          if(aux2.length > 0){
            var search_fallidos2 = search.create({type:'customrecord_lmry_ei_log_docs',filters:[{name:'internalid',operator:'anyof',values:aux2}],
              columns:['custrecord_lmry_ei_ld_response','custrecord_lmry_ei_ld_doc']});

            var result_fallidos = search_fallidos2.run().getRange({start:0,end:900});
            for(var j=0;j<result_fallidos.length;j++){
              json_full[result_fallidos[j].getValue('custrecord_lmry_ei_ld_doc')][3] = result_fallidos[j].getValue('custrecord_lmry_ei_ld_response');
            }
          }

        }
      }

      var tran_aceptados = new Array();
      var tran_fallidos = new Array();
      var tran_procesando = [];
      var errores = new Array();

      for(var i in json_full){
        if(json_full[i][1] == 'Aprobado'){
          tran_aceptados.push(json_full[i][2]);
        }else if(json_full[i][1] == 'Procesando'){
          tran_procesando.push(json_full[i][2]);
        }else{
          tran_fallidos.push(json_full[i][2]);
          if(json_full[i][3] == 'No' || json_full[i][3] == '' || json_full[i][3] == null){
            errores.push('No hay detalles del error');
          }else{
            errores.push(json_full[i][3]);
          }
          //errores.push(json_full[i][3]);
        }
      }

      var employee = search.lookupFields({type:search.Type.EMPLOYEE,columns:['email','firstname'],id:user_id});
      var employee_email = employee.email;
      var employee_name = employee.firstname;

      var body = messageBody(tran_aceptados ,tran_fallidos, errores, subsidiary, employee_name, tran_procesando);
      //log.error('Cantidad de caracteres correo',body.length);

      email.send({author: user_id,recipients: employee_email, subject: 'LatamReady - Advanced Sales Flow',body: body});

    }

    function tranid_json(json_invoice,arreglo){

      if(arreglo.length > 0){
        var aux_x = [];
        var x = 0;
        var bandera = true;
        while(bandera){
          aux_x = arreglo.slice(x,x+900);

          if(aux_x.length == 900){
            x = x + 900;
          }else{
            bandera = false;
          }
          // 2020.01.08 - Se agrego el fitro MainLine = 'T'
          var search_invoice = search.create({type:'transaction',columns:['internalid','tranid'],filters:[{name:'internalid',operator:'anyof',values:aux_x}, {name:'mainline',operator:'is',values:'T'}]});
          var result_invoice = search_invoice.run().getRange({start:0,end:900});

          if(result_invoice != null && result_invoice.length > 0){
            for(var a=0; a<result_invoice.length; a++){
              json_invoice[result_invoice[a].getValue('internalid')][2] = result_invoice[a].getValue('tranid');
            }
          }

        }
      }

      return json_invoice;

    }

    function messageBody(tranSent, tranFail, respond, subsidiary, name, tranProc){

      var body =  '<body text="#333333" link="#014684" vlink="#014684" alink="#014684">';
      body += '<table width="642" border="0" align="center" cellpadding="0" cellspacing="0">';
      body += '<tr>';
      body += '<td width="100%" valign="top">';
      body += '<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">';
      body += '<tr>';
      body += '<td width="100%" colspan="2"><img style="display: block;" src="https://system.na1.netsuite.com/core/media/media.nl?id=921&c=TSTDRV1038915&h=c493217843d184e7f054" width="645" alt="main banner"/></td>';
      body += '</tr>';
      body += '</table>';
      body += '<table width="100%" border="0" align="center" cellpadding="0" cellspacing="0">';
      body += '<tr>';
      body += '<td bgcolor="#d50303" width="15%">&nbsp;</td>';
      body += '<td bgcolor="#d50303" width="85%">';
      body += '<font style="color:#FFFFFF; line-height:130%; font-family:Arial, Helvetica, sans-serif; font-size:19px">';
      body += 'Estimado(a) ' + name + ':<br>';
      body += '</font>';
      body += '</td>';
      body += '</tr>';
      body += '<tr>';
      body += '<td width="100%" bgcolor="#d50303" colspan="2" align="right"><a href="http://www.latamready.com/#contac"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=923&c=TSTDRV1038915&h=3c7406d759735a1e791d" width="94" style="margin-right:45px" /></a></td>';
      body += '</tr>';
      body += '<tr>';
      body += '<td width="100%" bgcolor="#FFF" colspan="2" align="right">';
      body += '<a href="https://www.linkedin.com/company/9207808"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=924&c=TSTDRV1038915&h=c135e74bcb8d5e1ac356" width="15" style="margin:5px 1px 5px 0px" /></a>';
      body += '<a href="https://www.facebook.com/LatamReady-337412836443120/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=919&c=TSTDRV1038915&h=9c937774d04fb76747f7" width="15" style="margin:5px 1px 5px 0px" /></a>';
      body += '<a href="https://twitter.com/LatamReady"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=928&c=TSTDRV1038915&h=fc69b39a8e7210c65984" width="15" style="margin:5px 47px 5px 0px" /></a>';
      body += '</td>';
      body += '</tr>';
      body += '</table>';
      body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
      body += '<tr>';
      body += '<td width="15%">&nbsp;</td>';
      body += '<td width="70%">';
      body += '<font style="color:#333333;line-height:200%; font-family:Trebuchet MS, Helvetica, sans-serif; font-size:13px">';

      body += '<p>Este es un mensaje automatico de LatamReady SuiteApp.</p>';
      if(tranSent.length + tranFail.length == 1 + tranProc.length == 1){
        if(subsi_OW){
          body += '<p>Se ha enviado automaticamente una transaccion para:</p><ul>';
          body += '<li type="disc">Subsidiaria: ' + subsidiary + '</li>';
          body += '</ul>';
        }else{
          body += '<p>Se ha enviado automaticamente una transaccion</p>';
        }
      }else if(tranSent.length + tranFail.length + tranProc.length > 1){
        if(subsi_OW){
          body += '<p>Se ha enviado automaticamente un total de ' + (tranSent.length + tranFail.length + tranProc.length) + ' transacciones para:</p><ul>';
          body += '<li type="disc">Subsidiaria: ' + subsidiary + '</li>';
          body += '</ul>';
        }else{
          body += '<p>Se ha enviado automaticamente un total de ' + (tranSent.length + tranFail.length + tranProc.length) + ' transacciones</p>';
        }
      }
      body += '<p><b>Envios exitosos: </b>' + tranSent.length + '</p><ul>';
      for(i = 0; i < tranSent.length; i++){
        body += '<li type="disc">' + tranSent[i] + '</li>'
      }
      body += '</ul>';
      body += '<p><b>Envios procesando: </b>' + tranProc.length + '</p><ul>';
      for(i = 0; i < tranProc.length; i++){
        body += '<li type="disc">' + tranProc[i] + '</li>';
      }
      body += '</ul>';
      if(tranProc.length > 0){
        body += '<p>Verificar el estado de estos invoices en el record LatamReady - EI Document Status</p>';
      }
      body += '<p><b>Envios fallidos: </b>' + tranFail.length +'</p><ul>';
      for(i = 0; i < tranFail.length; i++){
        body += '<li type="disc">' + tranFail[i] + '</li>'
        body += '<p style="padding-left:20px;">' + respond[i] + '</p>'
      }
      body += '</ul>';

      body += '<p>Saludos,</p>';
      body += '<p>El Equipo de LatamReady</p>';
      body += '</font>';
      body += '</td>';
      body += '<td width="15%">&nbsp;</td>';
      body += '</tr>';
      body += '</table>';
      body += '<br>';
      body += '<table width="100%" border="0" cellspacing="0" cellpadding="2" bgcolor="#e5e6e7">';
      body += '<tr>';
      body += '<td>&nbsp;</td>';
      body += '</tr>';
      body += '<tr>';
      body += '<td width="15%">&nbsp;</td>';
      body += '<td width="70%" align="center">';
      body += '<font style="color:#333333;line-height:200%; font-family:Trebuchet MS, Helvetica, sans-serif; font-size:12px;" >';
      body += '<i>Este es un mensaje automatico. Por favor, no responda este correo electronico.</i>';
      body += '</font>';
      body += '</td>';
      body += '<td width="15%">&nbsp;</td>';
      body += '</tr>';
      body += '<tr>';
      body += '<td>&nbsp;</td>';
      body += '</tr>';
      body += '</table>';
      body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
      body += '<tr>';
      body += '<td width="15%">&nbsp;</td>';
      body += '<td width="70%" align="center">';
      body += '<a href="http://www.latamready.com/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=926&c=TSTDRV1038915&h=e14f0c301f279780eb38" width="169" style="margin:15px 0px 15px 0px" /></a>';
      body += '</td>';
      body += '<td width="15%">&nbsp;</td>';
      body += '</tr>';
      body += '</table>';
      body += '<table width="100%" border="0" cellspacing="0" cellpadding="2">';
      body += '<tr>';
      body += '<td width="15%">&nbsp;</td>';
      body += '<td width="70%" align="center">';
      body += '<a href="https://www.linkedin.com/company/9207808"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=925&c=TSTDRV1038915&h=41ec53b63dba135488be" width="101" style="margin:0px 5px 0px 5px" /></a>';
      body += '<a href="https://www.facebook.com/LatamReady-337412836443120/"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=920&c=TSTDRV1038915&h=7fb4d03fff9283e55318" width="101" style="margin:0px 5px 0px 5px" /></a>';
      body += '<a href="https://twitter.com/LatamReady"><img src="https://system.na1.netsuite.com/core/media/media.nl?id=929&c=TSTDRV1038915&h=300c376863035d25c42a" width="101" style="margin:0px 5px 0px 5px" /></a>';
      body += '</td>';
      body += '<td width="15%">&nbsp;</td>';
      body += '</tr>';
      body += '</table>';
      body += '<table width="100%" border="0" cellspacing="0">';
      body += '<tr>';
      body += '<td>';
      body += '<img src="https://system.na1.netsuite.com/core/media/media.nl?id=918&c=TSTDRV1038915&h=7f0198f888bdbb495497" width="642" style="margin:15px 0px 15px 0px" /></a>';
      body += '</td>';
      body += '</tr>';
      body += '</table>';
      body += '</td>';
      body += '</tr>';
      body += '</table>';
      body += '</body>';

      return body;
    }

    function path_file(name_file) {
      var path = '';
      try {
        var busqueda_file = search.create({
          type: 'file',
          filters: ['name', 'is', name_file],
          columns: ['internalid']
        });

        busqueda_file = busqueda_file.run().getRange(0,1);

        if (busqueda_file != '' && busqueda_file != null) {
          var id_file = busqueda_file[0].getValue('internalid');

          var file_Record = file.load({
            id: id_file
          });
          path = file_Record.path;
        }

      } catch (err) {
        libraryEmail.sendemail('[path_file] ' + err, LMRY_script);
      }
      path = path.substring(0,path.length-3);
      path = '/' + path;
      return path;
    }

    function allGetRps(id_transacciones, subsidiaria, pais){

      var RPS = '';
      var currentNumber = '';
      var idSerieImpresion = '';
      var concatenatedRPS = false;
      var jsonRPS = {};
      var banderaCurrent = false;
      var banderaMunicipio = false;

      var auxTransacciones = id_transacciones;
      auxTransacciones.pop();

      for(var i = 0; i < auxTransacciones.length; i++){
        jsonRPS[auxTransacciones[i]] = '';
      }

      if(pais == 'BRA'){

        //SETUP TAX SUBSIDIARY: RPS CONCATENADO
        var filtrosSetup = [];
        filtrosSetup[0] = search.createFilter({name: 'isinactive', operator: 'is', values: 'F'});
        if(subsi_OW){
          filtrosSetup[1] = search.createFilter({name: 'custrecord_lmry_setuptax_subsidiary', operator: 'is', values: subsidiaria});
        }

        var setupBR = search.create({type: 'customrecord_lmry_setup_tax_subsidiary', columns: ['custrecord_lmry_br_setuptax_concatenated'],
        filters: filtrosSetup });

        var setupBR = setupBR.run().getRange(0,1);

        if(setupBR && setupBR.length){
          concatenatedRPS = setupBR[0].getValue('custrecord_lmry_br_setuptax_concatenated');
        }

        //BR TRANSACTION FIELDS: INVOICES YA CON RPS
        var bandera = true, contadorBR = 0;

        var searchBR = search.create({type: 'customrecord_lmry_br_transaction_fields', columns: ['internalid','custrecord_lmry_br_rps','custrecord_lmry_br_related_transaction'],
        filters: [{name: 'custrecord_lmry_br_related_transaction', operator: 'anyof', values: auxTransacciones}]
        });

        var resultBR = searchBR.run();

        while(bandera){
          var auxResult = resultBR.getRange({start: contadorBR, end: contadorBR + 1000});

          if(auxResult.length == 0){
            break;
          }

          for(var i = 0; i < auxResult.length; i++){
            var idInvoice = auxResult[i].getValue('custrecord_lmry_br_related_transaction');
            var rps = auxResult[i].getValue('custrecord_lmry_br_rps') || '';

            jsonRPS[idInvoice] = rps;

          }

          if(auxResult.length == 1000){
            contadorBR += 1000;
          }else{
            bandera = false;
          }

        }

        //OBTENER EL RPS
        var filtrosSerie = [];
        filtrosSerie[0] = search.createFilter({name: 'custrecord_lmry_codigo_doc', join: 'custrecord_lmry_serie_tipo_doc_cxc', operator: 'is', values: '99'});
        filtrosSerie[1] = search.createFilter({name: 'isinactive', operator: 'is', values: 'F'});
        if(subsi_OW){
          filtrosSerie[2] = search.createFilter({name: 'custrecord_lmry_subsidiaria', operator: 'is', values: subsidiaria});
        }

        var searchSerie = search.create({type: 'customrecord_lmry_serie_impresion_cxc', columns: [{name: 'internalid',sort: search.Sort.ASC},'custrecord_lmry_serie_rango_ini','custrecord_lmry_serie_rango_fin','custrecord_lmry_rps_numero','custrecord_lmry_serie_impresion'],
        filters: filtrosSerie });

        var resultSerie = searchSerie.run().getRange({start:0,end:1});

        idSerieImpresion = resultSerie[0].getValue('internalid');

        var serieImpresion = resultSerie[0].getValue('custrecord_lmry_serie_impresion');
        var currentNumber = resultSerie[0].getValue('custrecord_lmry_rps_numero');
        var rangoFin = resultSerie[0].getValue('custrecord_lmry_serie_rango_fin');

        if(parseInt(currentNumber) < parseInt(rangoFin)){

          var codigoCity = '';
          var codigoSiafi = '';

          if(subsi_OW){
            var city = search.lookupFields({type: 'subsidiary', id: subsidiaria, columns: ['address.custrecord_lmry_addr_city','address.custrecord_lmry_addr_city_id','address.custrecord_lmry_addr_prov_id_siafi']});

            if(city['address.custrecord_lmry_addr_city_id']){
              codigoCity = city['address.custrecord_lmry_addr_city_id'];
            }

            if(city['address.custrecord_lmry_addr_prov_id_siafi']){
              codigoSiafi = city['address.custrecord_lmry_addr_prov_id_siafi'];
            }

          }else{
            var configCompany = config.load({type:config.Type.COMPANY_INFORMATION});

            if(configCompany.hasSubrecord('mainaddress')){
              var mainAddress = configCompany.getSubrecord('mainaddress');

              if(mainAddress.getValue('custrecord_lmry_addr_city_id')){
                codigoCity = mainAddress.getValue('custrecord_lmry_addr_city_id');
              }

              if(mainAddress.getValue('custrecord_lmry_addr_prov_id_siafi')){
                codigoSiafi = mainAddress.getValue('custrecord_lmry_addr_prov_id_siafi');
              }

            }

          }

          //Sao Paulo, Belo Horizonte, Valinhos, Brasilia
          var municipios = ['3550308','3106200','3556206','5300108'];

          if(municipios.indexOf(codigoCity) != -1){
            if(serieImpresion){
              RPS += serieImpresion;
            }

            RPS += codigoSiafi;

            banderaMunicipio = true;

          }

        }

        //SETEO DE RPS SOLO A INVOICES SIN ESTE
        if(banderaMunicipio){
          for(var i in jsonRPS){
            if(!jsonRPS[i]){
              currentNumber++;
              banderaCurrent = true;

              (concatenatedRPS) ? jsonRPS[i] = RPS + currentNumber : jsonRPS[i] = currentNumber;

            }
          }
        }


        //ACTUALIZACION DE SERIE
        if(banderaCurrent){
          record.submitFields({type: 'customrecord_lmry_serie_impresion_cxc', id: idSerieImpresion, values: {custrecord_lmry_rps_numero: currentNumber}, options: {ignoreMandatoryFields: true, disableTriggers: true}});
        }

      }

      return jsonRPS;

    }

    return {
      getInputData: getInputData,
      map: map,
      //reduce: reduce
      summarize: summarize
    };

  });
