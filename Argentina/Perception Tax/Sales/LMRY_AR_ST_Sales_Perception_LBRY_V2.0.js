  /**
 * @NApiVersion 2.0
 * @NModuleScope Public
 */

/* = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =\
||   This script for customer center (Time)                     ||
||                                                              ||
||  File Name: LMRY_AR_ST_Perception_LBRY_V2.0.js		            ||
||                                                              ||
||  Version Date         Author        Remarks                  ||
||  2.0     Sep 13 2021  LatamReady    Use Script 2.0           ||
 \= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = */

 define(["N/log", "N/record", "N/search", "N/runtime", "./LMRY_libSendingEmailsLBRY_V2.0", './LMRY_Log_LBRY_V2.0'
],
function (log, record, search, runtime, library, Library_Log) {

  var LMRY_script = "LatamReady - TAX AR Perception LBRY";
  var LMRY_SCRIPT_NAME = 'LMRY_AR_ST_Perception_LBRY_V2.0.js';

  var taxCalculated = false;
  var featureSubs = false;
  
  var FEATURE_DEPARTMENT = runtime.isFeatureInEffect({ feature: "DEPARTMENTS" });
  // Department, Class and Location
  var FEATURE_CLASSES = runtime.isFeatureInEffect({ feature: "CLASSES" });
  var FEATURE_LOCATIONS = runtime.isFeatureInEffect({ feature: "LOCATIONS" });
  
  // Accounting Preferences
  var userObj = runtime.getCurrentUser();
  var MANDATORY_DEPARTMENT = userObj.getPreference({ name: "DEPTMANDATORY" });
  var MANDATORY_LOCATION = userObj.getPreference({ name: "LOCMANDATORY" });
  var MANDATORY_CLASS = userObj.getPreference({ name: "CLASSMANDATORY" });
  
  var FEATURE_SUBSIDIARIES = runtime.isFeatureInEffect({ feature: "SUBSIDIARIES" });
  var FEATURE_MULTIBOOK = runtime.isFeatureInEffect({ feature: "MULTIBOOK" });
  var USER = runtime.getCurrentUser();
  
  var exchange_global = 1;
  var numLines = 1;
  var filtroTransactionType = "";
  // var cantidad = 0;
  
  /*********************************************************************************************************
   * Funcion que realiza el calculo de los impuestos.
   * Para Peru: Llamada desde el User Event del Invoice, Credit Memo.
   ********************************************************************************************************/
  function applyPerception(scriptContext){
    try {
      var typeContext = scriptContext.type;
      if (typeContext == "create" || typeContext == "edit") {
        var recordObj = scriptContext.newRecord;
        
        var override = recordObj.getValue('taxdetailsoverride');
        if(override == false || override == 'F'){
          return true;
        }

        numLines = recordObj.getLineCount('item');
        soloItems = numLines;
        // var auto_wht = recordObj.getValue('custbody_lmry_apply_wht_code');
        var legalDocType = recordObj.getValue("custbody_lmry_document_type");
        var fieldStatus = recordObj.getField({fieldId: 'custbody_psg_ei_status'});
        var eDocStatus = '';
        if (fieldStatus != '' && fieldStatus != null) {
          eDocStatus = recordObj.getValue("custbody_psg_ei_status");
          if (eDocStatus != null && eDocStatus != '') {
            eDocStatus = search.lookupFields({ type: 'customlist_psg_ei_status', id: eDocStatus, columns: ['name'] });
            eDocStatus = eDocStatus.name;
          }
        }
        switch (recordObj.type) {
          case 'invoice': filtroTransactionType = 1; break;
          case 'creditmemo': filtroTransactionType = 8; break;
          case 'cashsale': filtroTransactionType = 3; break;
        }
        if (validarTipoDoc(legalDocType) && (eDocStatus != "Sent" && eDocStatus != "Enviado")) {
          var hayTributo = contieneTributo(recordObj, numLines);
          if (!hayTributo) {
            var transactionDate = recordObj.getText("trandate");
            // transactionDate = format.format({value: transactionDate, type: format.Type.DATE});
            var entity = recordObj.getValue("entity");

            // Verifica si esta activo el Feature Proyectos
            var featjobs = runtime.isFeatureInEffect({feature: "JOBS"});
            if (featjobs == true) {
                var ajobs = search.lookupFields({ type: search.Type.JOB, id: entity, columns: ['customer'] });
                    if (ajobs.customer) {
                        entity = ajobs.customer[0].value;
                    }
            }
            var subsidiary = recordObj.getValue("subsidiary");
            var responsableType = search.lookupFields({ type: search.Type.CUSTOMER, id: entity, columns: ['custentity_lmry_ar_tiporespons'] }); 
            // Se valida que el campo no este vacio
            if (responsableType.custentity_lmry_ar_tiporespons.length == 0 || responsableType == '' || responsableType == null) {
              return true;
            }
            var RespType = responsableType.custentity_lmry_ar_tiporespons[0].value;

            var setupSubsidiary = getSetupTaxSubsidiary(subsidiary);
            var tipoRedondeo = setupSubsidiary["rounding"];
            var apply_line = setupSubsidiary["applyLine"];
            var setup_department = setupSubsidiary["dapartment"];
            var setup_class = setupSubsidiary["class"];
            var setup_location = setupSubsidiary["location"];
            var arregloSegmentacion = [setup_department, setup_class, setup_location];
            exchange_global = getExchangeRate(recordObj, subsidiary, setupSubsidiary);

            var searchResultCC = getContributoryClasses(subsidiary, transactionDate, filtroTransactionType, entity, legalDocType, RespType);
            var searchResultNT = getNationalTaxes(subsidiary, transactionDate, filtroTransactionType, legalDocType, RespType);
            log.error("searchResultCC", searchResultCC)
            log.error("searchResultNT", searchResultCC)
            
            addItem("1", searchResultCC, recordObj, tipoRedondeo, arregloSegmentacion, "");
            addItem("1", searchResultNT, recordObj, tipoRedondeo, arregloSegmentacion, "");
            
            if (apply_line) {
              for (var i = 0; i < soloItems; i++) {
                var gross_item = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'grossamt', line: i });
                var tax_item = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'tax1amt', line: i });
                var net_item = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i });
                var id_item = recordObj.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
  
                var info_item = id_item + "|" + gross_item + "|" + tax_item + "|" + net_item;
                addItem("2", searchResultCC, recordObj, tipoRedondeo, arregloSegmentacion, info_item);
                addItem("2", searchResultNT, recordObj, tipoRedondeo, arregloSegmentacion, info_item);
              }
            } 
          }
        }
      }
    }
    catch (err) {
      log.error("Error applyPerception", err);
      library.sendemail(' [ After Submit - applyPerception] ' + err, LMRY_script);
      Library_Log.doLog({ title: '[ After Sumbit - applyPerception ]', message: err, relatedScript: LMRY_SCRIPT_NAME });
    }
  }
  
  /**************************************************************
   * Validar si el tipo de documento de la transaccion se
   * encuentra en el registro personalizado
   *    - tipoDoc: Tipo de docuemnto legal de la transaccion
   *********************************************************** */
  function validarTipoDoc(tipoDoc) {
    try {
      var tipoDocEncontrado = false;
  
      if (tipoDoc == '' || tipoDoc == null) {
        return tipoDocEncontrado;
      }
  
      var busqDocTypePerc = search.create({
        type: 'customrecord_lmry_ar_doctype_percep', 
        columns: ['custrecord_lmry_ar_doctype_percep'],
        filters: [['custrecord_lmry_ar_doctype_percep', 'anyof', tipoDoc]]
      });
  
      var resultDocTypePerc = busqDocTypePerc.run().getRange(0, 1);
      if (resultDocTypePerc != null && resultDocTypePerc.length != 0) {
        tipoDocEncontrado = true;
      }
      return tipoDocEncontrado;
    } catch (err) {
      // Envio de mail con errores
      log.error("[ applyPerception - validarTipoDoc ]", err);
      LibraryMail.sendemail('[ applyPerception - validarTipoDoc ] ' + err, Name_script);
      Library_Log.doLog({ title: '[ applyPerception - validarTipoDoc ]', message: err, relatedScript: LMRY_SCRIPT_NAME });
    }
  }
  
  /**************************************************************
   * Verifica si en la lineas (item) esta marcado el campo
   * personalizado.
   *    - recordObj: Objeto record
   *    - numLines: Numero de lineas de item
   *************************************************************/
  function contieneTributo(recordObj, numLines) {
    try {
      var tributo = false;
      for (var i = 0; i < numLines; i++) {
        var tiene_tributo = recordObj.getSublistValue('item', 'custcol_lmry_ar_item_tributo', i);
        var perception_percentage = recordObj.getSublistValue('item', 'custcol_lmry_ar_perception_percentage', i);
        if (tiene_tributo == true && (perception_percentage != null && perception_percentage != '')) {
          tributo = true;
        }
      }
      return tributo;
    }
    catch (e) {
      log.error("[ applyPerception - contieneTributo ]", e);
      LibraryMail.sendemail('[ applyPerception - contieneTributo ] ' + err, Name_script);
      Library_Log.doLog({ title: '[ applyPerception - contieneTributo ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /**********************************************************
  * Busqueda en el record: LatamReady - Setup Tax Subsidiary
  *    - subsidiary: Subsidiaria
  **********************************************************/
  function getSetupTaxSubsidiary(subsidiary) {
    try{
      var featureSubs = runtime.isFeatureInEffect({
        feature: "SUBSIDIARIES",
      });
      var filters = [
        ['isinactive', 'is', 'F'], 'AND'
      ];
      if (featureSubs == true || featureSubs == 'T') {
        filters.push(['custrecord_lmry_setuptax_subsidiary', 'anyof', subsidiary]);
      }
  
      var search_setupSub = search.create({
        type: 'customrecord_lmry_setup_tax_subsidiary',
        filters: filters,
        columns: ['custrecord_lmry_setuptax_currency', 'custrecord_lmry_setuptax_depclassloc', 'custrecord_lmry_setuptax_type_rounding', 'custrecord_lmry_setuptax_department', 'custrecord_lmry_setuptax_class','custrecord_lmry_setuptax_location', 'custrecord_lmry_setuptax_apply_line']
      });
  
      var results = search_setupSub.run().getRange(0, 1);
  
      var setupSubsidiary = {};
  
      if (results && results.length > 0) {
        setupSubsidiary['isDefaultClassification'] = results[0].getValue('custrecord_lmry_setuptax_depclassloc');
        setupSubsidiary['rounding'] = results[0].getValue('custrecord_lmry_setuptax_type_rounding');
        setupSubsidiary['department'] = results[0].getValue('custrecord_lmry_setuptax_department');
        setupSubsidiary['class'] = results[0].getValue('custrecord_lmry_setuptax_class');
        setupSubsidiary['location'] = results[0].getValue('custrecord_lmry_setuptax_location');
        setupSubsidiary['currency'] = results[0].getValue('custrecord_lmry_setuptax_currency');
        setupSubsidiary['applyLine'] = results[0].getValue('custrecord_lmry_setuptax_apply_line');
      }
      return setupSubsidiary;
    }
    catch(e){
      log.error("[ applyPerception - getSetupTaxSubsidiary ]", e);
      library.sendemail(' [ applyPerception - getSetupTaxSubsidiary] ' + e, LMRY_script);
      Library_Log.doLog({ title: '[ applyPerception - getSetupTaxSubsidiary ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /*******************************************************************************************
  * Obtención del ExchangeRate de la transaccion o Multibook para la conversión a moneda base
  *    - recordObj: Objeto record
  *    - subsidiary: Subsidiaria
  *    - setupSubsidiary: Objeto de Setup Tax Subsidiary
  *******************************************************************************************/
  function getExchangeRate (recordObj, subsidiary, setupSubsidiary){
    try {
      var exchangeRate = 1;
      log.error("featureMB, featureSubs", FEATURE_MULTIBOOK + ", " + FEATURE_SUBSIDIARIES)

      var currency_setup = setupSubsidiary['currency'];
      var currency_invoice = recordObj.getValue("currency");
      var currency_subsidiary = "";
      if (FEATURE_SUBSIDIARIES) {
        currency_subsidiary = search.lookupFields({ type: "subsidiary", id: subsidiary, columns: ['currency'] });
        currency_subsidiary = currency_subsidiary.currency[0].value;
      }
      if (currency_setup == currency_invoice) {
        exchangeRate = 1;
      }
      if (currency_setup != currency_invoice && currency_setup == currency_subsidiary) {
        exchangeRate = parseFloat(recordObj.getValue("exchangerate"));
      }
      if (currency_setup != currency_invoice && currency_setup != currency_subsidiary && FEATURE_MULTIBOOK == true) {
        var lineas_book = recordObj.getLineCount({ sublistId: 'accountingbookdetail' });
        if (lineas_book > 0) {
          for (var k = 0; k < lineas_book; k++) {
            var currency_book = recordObj.getSublistValue({ sublistId: 'accountingbookdetail', fieldId: 'currency', line: k });
            if (currency_book == currency_setup) {
              exchangeRate = parseFloat(recordObj.getSublistValue({ sublistId: 'accountingbookdetail', fieldId: 'exchangerate', line: k }));
              break;
            }
          }
        }
      }
      return exchangeRate;
    } catch(e){
      log.error("[ applyPerception - getExchangeRate ]", e);
      library.sendemail(' [ applyPerception - getExchangeRate] ' + e, LMRY_script);
      Library_Log.doLog({ title: '[ applyPerception - getExchangeRate ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
    }
  }
  
  /***************************************************************************
  * BUSQUEDA DEL RECORD: LATAMREADY - CONTRIBUTORY CLASS
  *    - subsidiary: Subsiaria
  *    - transactionDate: Fecha de creación de la transacción
  *    - filtroTransactionType: Invoice / Credit Memo
  *    - entity: ID de la Entidad
  *    - documentType: Tipo de Documento Fiscal
  ***************************************************************************/
  function getContributoryClasses (subsidiary, transactionDate, filtroTransactionType, entity, documentType, RespType) {
    try {
      var filtrosCC = [
        ["isinactive", "is", "F"],
        "AND",
        ["custrecord_lmry_ar_ccl_fechdesd", "onorbefore", transactionDate],
        "AND",
        ["custrecord_lmry_ar_ccl_fechhast", "onorafter", transactionDate],
        "AND",
        ["custrecord_lmry_ccl_transactiontypes", "anyof", filtroTransactionType],
        "AND",
        ["custrecord_lmry_ar_ccl_entity", "anyof", entity],
        "AND",
        ["custrecord_lmry_ccl_taxtype", "anyof", "2"], //1:Retencion, 2:Percepcion, 3:Detraccion, 4:Calculo de Impuesto
        "AND",
        ["custrecord_lmry_ccl_gen_transaction", "anyof", "4"], //1:Journal, 2:SuiteGL, 3:LatamTax(Purchase), 4:Add Line, 5: WhtbyTrans, 6: LatamTax (Sales)
        "AND",
        ['custrecord_lmry_ar_ccl_resptype', 'anyof', RespType]
      ];
      var documents = ["@NONE@"];
      if (documentType) {
        documents.push(documentType);
      }
      filtrosCC.push("AND", ["custrecord_lmry_ccl_fiscal_doctype", "anyof", documents]);
      if (FEATURE_SUBSIDIARIES) {
        filtrosCC.push("AND", ["custrecord_lmry_ar_ccl_subsidiary", "anyof", subsidiary]);
      }
      var searchCC = search.create({
        type: "customrecord_lmry_ar_contrib_class",
        columns: [
          "custrecord_lmry_ar_ccl_taxrate",
          "custrecord_lmry_ar_ccl_department",
          "custrecord_lmry_ar_ccl_class",
          "custrecord_lmry_ar_ccl_location",
          "custrecord_lmry_ccl_applies_to_account",
          "custrecord_lmry_ar_ccl_taxitem",
          "custrecord_lmry_ccl_description",
          "custrecord_lmry_ccl_addratio",
          "custrecord_lmry_ccl_minamount",
          "custrecord_lmry_ccl_maxamount",
          "custrecord_lmry_ccl_set_baseretention",
          "custrecord_lmry_ccl_base_amount",
          "custrecord_lmry_ccl_not_taxable_minimum",
          "custrecord_lmry_ccl_appliesto",
          "custrecord_lmry_ar_ccl_jurisdib",
          "custrecord_lmry_ar_normas_iibb",
          "custrecord_lmry_amount",
          search.createColumn({name: 'subtype', join: 'custrecord_lmry_ar_ccl_taxitem'}),
          search.createColumn({name: 'custrecord_lmry_ar_wht_regimen', join:  'custrecord_lmry_ar_regimen'}),
          "custrecord_lmry_ccl_applies_to_item"
        ],
        filters: filtrosCC,
      });
      var searchResultCC = searchCC.run().getRange({start: 0,end: 1000});
      return searchResultCC;
    }
    catch (e) {
      log.error("[ applyPerception - getContributoryClasses ]", e);
      library.sendemail(' [ applyPerception - getContributoryClasses] ' + e, LMRY_script);
      Library_Log.doLog({ title: '[ applyPerception - getContributoryClasses ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
    }
  }

  /***************************************************************************
  * BUSQUEDA DEL RECORD: LATAMREADY - NATIONAL TAX
  *    - subsidiary: Subsiaria
  *    - transactionDate: Fecha de creación de la transacción
  *    - filtroTransactionType: Invoice / Credit Memo
  *    - documentType: Tipo de Documento Fiscal
  ***************************************************************************/
  function getNationalTaxes (subsidiary, transactionDate, filtroTransactionType, documentType, RespType) {
    try {
      var filtrosNT = [
        ["isinactive", "is", "F"],
        "AND",
        ["custrecord_lmry_ntax_datefrom", "onorbefore", transactionDate],
        "AND",
        ["custrecord_lmry_ntax_dateto", "onorafter", transactionDate],
        "AND",
        ["custrecord_lmry_ntax_transactiontypes", "anyof", filtroTransactionType],
        "AND",
        ["custrecord_lmry_ntax_taxtype", "anyof", "2"],
        "AND",
        ["custrecord_lmry_ntax_gen_transaction", "anyof", "4"],
      ];
   
      var documents = ["@NONE@"];
      if (documentType) {
        documents.push(documentType);
      }
      filtrosNT.push("AND", ["custrecord_lmry_ntax_fiscal_doctype", "anyof", documents]);
   
      var featureSubs = runtime.isFeatureInEffect({feature: "SUBSIDIARIES"});
   
      if (featureSubs) {
        filtrosNT.push("AND", ["custrecord_lmry_ntax_subsidiary", "anyof", subsidiary]);
      }
  
      var searchNT = search.create({
        type: "customrecord_lmry_national_taxes",
        columns: [
          "custrecord_lmry_ntax_taxrate",
          "custrecord_lmry_ntax_department",
          "custrecord_lmry_ntax_class",
          "custrecord_lmry_ntax_location",
          "custrecord_lmry_ntax_applies_to_account",
          "custrecord_lmry_ntax_taxitem",
          "custrecord_lmry_ntax_description",
          "custrecord_lmry_ntax_addratio",
          "custrecord_lmry_ntax_minamount",
          "custrecord_lmry_ntax_maxamount",
          "custrecord_lmry_ntax_set_baseretention",
          "custrecord_lmry_ntax_base_amount",
          "custrecord_lmry_ntax_not_taxable_minimum",
          "custrecord_lmry_ntax_appliesto",
          "custrecord_lmry_ntax_jurisdib",
          "custrecord_lmry_ntax_iibb_norma",
          "custrecord_lmry_ntax_amount",
          search.createColumn({ name: 'subtype', join: 'custrecord_lmry_ntax_taxitem' }),
          search.createColumn({ name: 'custrecord_lmry_ar_wht_regimen', join: 'custrecord_lmry_ntax_regimen' }),
          search.createColumn({ name: 'custrecord_lmry_ntax_applies_to_item' }),
        ],
        filters: filtrosNT,
      });
      var searchResultNT = searchNT.run().getRange({
        start: 0,
        end: 1000,
      });
      return searchResultNT;
    }
    catch (e) {
      log.error("[ applyPerception - getNationalTaxes ]", e);
      library.sendemail(' [ applyPerception - getNationalTaxes] ' + e, LMRY_script);
      Library_Log.doLog({ title: '[ applyPerception - getNationalTaxes ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
    }
  }
   
  function addItem(appliesTo, result_CCNT, recordObj, tipoRedondeo, segmentacion, infoItem) {
    try {
      
      var subtotal_invoice = parseFloat(recordObj.getValue("subtotal")) * parseFloat(exchange_global);
      var total_invoice = parseFloat(recordObj.getValue("total")) * parseFloat(exchange_global);
      var taxtotal_invoice = parseFloat(recordObj.getValue("taxtotal")) * parseFloat(exchange_global);
  
      var department_setup = segmentacion[0];
      var class_setup = segmentacion[1];
      var location_setup = segmentacion[2];
  
      if (result_CCNT != null && result_CCNT.length > 0) {
        for (var i = 0; i < result_CCNT.length; i++) {
          var row = result_CCNT[i].columns;
  
          var tax_rate = result_CCNT[i].getValue(row[0]); // Latam AR - Tax rate
          var r_department = result_CCNT[i].getValue(row[1]);
          var r_class = result_CCNT[i].getValue(row[2]);
          var r_location = result_CCNT[i].getValue(row[3]);
          var applies_account = result_CCNT[i].getValue(row[4]);
          var tax_item = result_CCNT[i].getValue(row[5]); // Latam AR - Tax item
          var description = result_CCNT[i].getValue(row[6]);
          var ratio = result_CCNT[i].getValue(row[7]);
          var minimo = result_CCNT[i].getValue(row[8]);
          var maximo = result_CCNT[i].getValue(row[9]);
          var setbaseretention = result_CCNT[i].getValue(row[10]);
          var dobaseamount = result_CCNT[i].getValue(row[11]);
          var minimonoimponible = result_CCNT[i].getValue(row[12]);
          var applies_to_CCNT = result_CCNT[i].getValue(row[13]);
          var juriisibb = result_CCNT[i].getValue(row[14]); // Latam AR - IIBB Jurisdiction
          var iibbnorma = result_CCNT[i].getValue(row[15]); // Latam AR - IIBB Norma
          var amount_to = result_CCNT[i].getValue(row[16]);
          var itmsubtype = result_CCNT[i].getValue(row[17]); // Item SubType
          var regimenen = result_CCNT[i].getValue(row[18]); // Latam AR - Regimen
          var applies_to_item = result_CCNT[i].getValue(row[19]);
  
          if (description == null) {
            description = '';
          }

          log.error("itmsubtype", itmsubtype)
          // Valida si es articulo para las ventas
          if (itmsubtype != 'Para la venta' && itmsubtype != 'For Sale' && itmsubtype != 'Para reventa' && itmsubtype != 'For Resale') {
            continue;
          }
  
          if (appliesTo != applies_to_CCNT) {
            continue;
          }
  
          if (applies_to_CCNT == '2') { // lines
            var aux_item = infoItem.split("|");
            if (applies_to_item != aux_item[0]) {
              continue;
            }
          }
  
          if (setbaseretention == null || setbaseretention == '' || setbaseretention < 0) {
            setbaseretention = 0;
          }
  
          if (minimonoimponible == null || minimonoimponible == '' || minimonoimponible < 0) {
            minimonoimponible = 0;
          }
  
          if (maximo == null || maximo == '' || maximo < 0) {
            maximo = 0;
          }
  
          if (minimo == null || minimo == '' || minimo < 0) {
            minimo = 0;
          }
  
          if (ratio == null || ratio == '' || ratio <= 0) {
            ratio = 1;
          }
  
          minimo = parseFloat(minimo);
          maximo = parseFloat(maximo);
          setbaseretention = parseFloat(setbaseretention);
          minimonoimponible = parseFloat(minimonoimponible);
  
          var amount_base;
   
          if (applies_to_CCNT == '1') { // total
            if (amount_to == 1) { // GROSS 
              amount_base = total_invoice; 
            } 
            if (amount_to == 2) { // TAX TOTAL
              if (taxtotal_invoice > 0) {
                amount_base = taxtotal_invoice;
              } else {
                continue;
              }
            }
            if (amount_to == 3) { // NET 
              amount_base = subtotal_invoice; 
            }
          }
  
          if (applies_to_CCNT == '2') { // lines
            var aux_itemg = infoItem.split("|");
            
            if (amount_to == 1) { // GROSS
              amount_base = parseFloat(aux_itemg[1]) * parseFloat(exchange_global); 
            }
            if (amount_to == 2) { // TAX TOTAL
              if (aux_itemg[2] > 0) {
                amount_base = parseFloat(aux_itemg[2]) * parseFloat(exchange_global);
              } else {
                continue;
              }
            }
            if (amount_to == 3) { // NET
              amount_base = parseFloat(aux_itemg[3]) * parseFloat(exchange_global); 
            }
          }
  
          amount_base = parseFloat(amount_base) - parseFloat(minimonoimponible);
  
          if (amount_base <= 0) {
            continue;
          }
  
          if (minimo > 0) {
            if (amount_base > minimo) {
              if (maximo > 0) {
                if (maximo > minimo && maximo >= amount_base) {
                  if (dobaseamount == 2 || dobaseamount == 5) {amount_base = parseFloat(amount_base) - parseFloat(minimo);} 
                  if (dobaseamount == 3) {amount_base = minimo;}
                  if (dobaseamount == 4) {amount_base = maximo;}
                } else {
                  continue;
                }
              } else {
                if (dobaseamount == 2 || dobaseamount == 5) {amount_base = parseFloat(amount_base) - parseFloat(minimo);}
                if (dobaseamount == 3) {amount_base = minimo;}
              }
            } else {
              continue;
            }
          } else { // Hay una validacion minimo en CC > 0
            if (maximo > minimo) {
              if (maximo >= amount_base) {
                if (dobaseamount == 2 || dobaseamount == 5) {amount_base = parseFloat(amount_base) - parseFloat(minimo);}
                // if (dobaseamount == 3) {amount_base = minimo;}
                if (dobaseamount == 4) {amount_base = maximo;}
              } else {
                continue;
              }
            }
          }
  
          //RETENCION
          var retencion = parseFloat(setbaseretention) + parseFloat(amount_base) * parseFloat(ratio) * parseFloat(tax_rate);
          retencion = parseFloat(Math.round(parseFloat(retencion) * 1000000) / 1000000);
          retencion = parseFloat(Math.round(parseFloat(retencion) * 10000) / 10000);
          var retencion_peso = retencion;
  
          var aux_cadena = retencion + ";";
          retencion = parseFloat(retencion) / parseFloat(exchange_global);
          amount_base = parseFloat(amount_base) / parseFloat(exchange_global);
  
          if (tipoRedondeo == '1') {
            if (parseFloat(retencion) - parseInt(retencion) < 0.5) {
              retencion = parseInt(retencion);
            }
            else {
              retencion = parseInt(retencion) + 1;
            }
          }
          if (tipoRedondeo == '2') {
            retencion = parseInt(retencion);
          }
  
          if (applies_account != '' && applies_account != null) {
            aux_cadena += applies_account;
          }
  
          retencion = parseFloat(Math.round(parseFloat(retencion) * 100) / 100);
  
          var retencion_transaccion = parseFloat(retencion) * parseFloat(exchange_global);
          retencion_transaccion = Math.round(parseFloat(retencion_transaccion) * 10000) / 10000;
  
          var adjustment = parseFloat(retencion_peso) - parseFloat(retencion_transaccion);
  
          adjustment = adjustment.toFixed(4);
  
          // Agrega una linea en blanco
          recordObj.insertLine('item', numLines);
          recordObj.setSublistValue('item', 'item', numLines, tax_item);
  
          recordObj.setSublistValue('item', 'description', numLines, description);
          recordObj.setSublistValue('item', 'quantity', numLines, 1);
          recordObj.setSublistValue('item', 'rate', numLines, parseFloat(retencion));
          recordObj.setSublistValue('item', 'custcol_lmry_ar_perception_percentage', numLines, parseFloat(tax_rate));
          recordObj.setSublistValue('item', 'custcol_lmry_ar_item_tributo', numLines, true);
          recordObj.setSublistValue('item', 'custcol_lmry_base_amount', numLines, amount_base);
          recordObj.setSublistValue('item', 'custcol_lmry_ar_perception_account', numLines, aux_cadena);
          recordObj.setSublistValue('item', 'custcol_lmry_ar_perception_adjustment', numLines, adjustment);
  
          // Name: Latam Col - AR Norma IIBB - ARCIBA
          if (iibbnorma != '' && iibbnorma != null) {
            recordObj.setSublistValue('item', 'custcol_lmry_ar_norma_iibb_arciba', numLines, iibbnorma);
          }
          // Name: Latam Col - AR Jurisdiccion IIBB
          if (juriisibb != '' && juriisibb != null) {
            recordObj.setSublistValue('item', 'custcol_lmry_ar_col_jurisd_iibb', numLines, juriisibb);
          }
          // Name: Latam Col - AR Regimen
          if (regimenen != '' && regimenen != null) {
            recordObj.setSublistValue('item', 'custcol_lmry_ar_col_regimen', numLines, regimenen);
          }
          
          // Department
          if (FEATURE_DEPARTMENT || FEATURE_DEPARTMENT == 'T') {
            if (r_department != '' && r_department != null) {
              recordObj.setSublistValue('item', 'department', numLines, r_department);
            } else {
              if (MANDATORY_DEPARTMENT || MANDATORY_DEPARTMENT == 'T') {
                recordObj.setSublistValue('item', 'department', numLines, department_setup);
              }
            }
          }
  
          // Class
          if (FEATURE_CLASSES || FEATURE_CLASSES == 'T') {
            if (r_class != '' && r_class != null) {
              recordObj.setSublistValue('item', 'class', numLines, r_class);
            } else {
              if (MANDATORY_CLASS || MANDATORY_CLASS == 'T') {
                recordObj.setSublistValue('item', 'class', numLines, class_setup);
              }
            }
          }
  
          var fieldLocation = recordObj.getSublistField({ sublistId: 'item', fieldId: 'location', line: numLines });
          // Location
          if (fieldLocation != '' && fieldLocation != null && (FEATURE_LOCATIONS || FEATURE_LOCATIONS == 'T')) {
            if (r_location != '' && r_location != null) {
              recordObj.setSublistValue('item', 'location', numLines, r_location);
            } else {
              if (MANDATORY_LOCATION || MANDATORY_LOCATION == 'T') {
                recordObj.setSublistValue('item', 'location', numLines, location_setup);
              }
            }
          }
  
          // Incrementa las lineas
          numLines++;
        }
      }
    }
    catch (e) {
      log.error("[ applyPerception - addItem ]", e);
      library.sendemail(' [ applyPerception - addItem] ' + e, LMRY_script);
      Library_Log.doLog({ title: '[ applyPerception - addItem ]', message: e, relatedScript: LMRY_SCRIPT_NAME });
    }
    
  }
  // Regresa la funcion para el User Event
  return {
    applyPerception: applyPerception
  };

});